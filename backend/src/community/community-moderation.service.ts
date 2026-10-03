import { Injectable, Logger } from '@nestjs/common';
import {
  CommunityContentStatus,
  CommunityModerationAction,
  CommunityModerationActionType,
  CommunityReason,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CommunityAccessService } from './community-access.service';
import {
  communityContactEmail,
  frontendUrl,
  hideThreshold,
  reportMinAccountAgeDays,
} from './community.config';
import {
  APPEAL_WINDOW_DAYS,
  CommunityErrorCode,
  FEED_MAX_LIMIT,
  NOTIFICATION_RETRY_DAYS,
  NOTIFICATION_RETRY_MAX_PER_RUN,
  REPORTS_PER_HOUR,
} from './community.constants';
import { badRequest, notFound } from './community.errors';
import { afterCursor, decodeCursor, paginate } from './cursor';
import { handleKey } from './handle';
import { CommunityMediaService } from './media/community-media.service';
import {
  APPEALABLE_ACTIONS,
  frontendLocalePrefix,
  reasonLabel,
  renderModerationDecision,
  renderReportDecision,
} from './moderation-mail';
import { cleanText } from './text-filters';
import {
  AppealDto,
  ModerationDecisionDto,
  ModerationNoteDto,
  ReportDto,
  ResolveAppealDto,
  SuspendDto,
} from './dto/community.dto';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const EXCERPT_LENGTH = 140;

export type ContentType = 'POST' | 'COMMENT';

interface TargetInfo {
  type: ContentType;
  id: string;
  authorId: string;
  status: CommunityContentStatus;
  body: string;
  reviewedAt: Date | null;
  /** Commentaire : publication parente (statut et auteur, pour la visibilité). */
  post?: { id: string; status: CommunityContentStatus; authorId: string };
}

/**
 * Lien de la page « décision » (lecture et recours) du frontend : `/communaute/decisions/:id`,
 * précédé du préfixe de locale hors français (`/en/communaute/decisions/:id`, next-intl
 * « as-needed »).
 */
export function decisionUrl(actionId: string, locale?: string | null): string {
  return `${frontendUrl()}${frontendLocalePrefix(locale)}/communaute/decisions/${actionId}`;
}

/**
 * Signalements qui comptent dans le seuil de masquage automatique : émis par un membre (compte non
 * invité, e-mail vérifié, profil communautaire actif) dont le compte a au moins
 * COMMUNITY_REPORT_MIN_ACCOUNT_AGE_DAYS jours. Les autres restent dans la file des opérateurs.
 */
export function qualifyingReporter(
  now: Date = new Date(),
): Prisma.UserWhereInput {
  return {
    isGuest: false,
    emailVerifiedAt: { not: null },
    communityProfile: { isNot: null },
    createdAt: {
      lte: new Date(now.getTime() - reportMinAccountAgeDays() * DAY_MS),
    },
  };
}

/** Résultat d'une relance des notifications (job de maintenance). */
export interface NotificationRetryCounts {
  /** Notifications de décision envoyées aux auteurs de contenus. */
  decisions: number;
  /** Notifications de décision envoyées aux auteurs de signalements. */
  reports: number;
}

export function appealDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + APPEAL_WINDOW_DAYS * DAY_MS);
}

/**
 * Modération (règlement européen sur les services numériques, DSA) :
 * - signalement par tout compte connecté, motif dans une liste fermée (art. 16) ;
 * - masquage automatique au-delà de COMMUNITY_HIDE_THRESHOLD signalements distincts émis par des
 *   membres établis (`qualifyingReporter`) ; les autres signalements vont en file opérateur ;
 * - décisions des opérateurs (masquer, rétablir, supprimer, classer, suspendre), toujours motivées
 *   et notifiées à l'auteur avec les voies de recours (art. 17) ;
 * - auteurs des signalements informés de la décision (art. 16(5)) : e-mail et
 *   `GET /community/me/reports` ;
 * - recours interne gratuit pendant 6 mois, tranché par une personne (art. 20) ;
 * - journal des décisions (`CommunityModerationAction`).
 */
@Injectable()
export class CommunityModerationService {
  private readonly logger = new Logger(CommunityModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CommunityAccessService,
    private readonly media: CommunityMediaService,
    private readonly mail: MailService,
  ) {}

  // -------------------------------------------------------------------------
  // Signalements
  // -------------------------------------------------------------------------

  async report(
    reporterId: string,
    type: ContentType,
    id: string,
    dto: ReportDto,
  ): Promise<{ reported: true; alreadyReported: boolean }> {
    await this.access.loadActor(reporterId);
    const target = await this.loadTarget(type, id);
    if (!target || !(await this.isVisibleTo(target, reporterId))) {
      throw notFound();
    }
    if (target.authorId === reporterId) {
      throw badRequest(
        CommunityErrorCode.CANNOT_REPORT_OWN,
        'You cannot report your own content.',
      );
    }
    const where = type === 'POST' ? { postId: id } : { commentId: id };
    const existing = await this.prisma.communityReport.findFirst({
      where: { reporterId, ...where },
      select: { id: true },
    });
    if (existing) return { reported: true, alreadyReported: true };

    await this.access.enforceRate(
      (since) =>
        this.prisma.communityReport.count({
          where: { reporterId, createdAt: { gt: since } },
        }),
      REPORTS_PER_HOUR,
      HOUR_MS,
      'reports',
    );
    const details = cleanText(dto.details);
    try {
      await this.prisma.communityReport.create({
        data: {
          reporterId,
          ...where,
          reason: dto.reason,
          details: details || null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { reported: true, alreadyReported: true };
      }
      throw error;
    }
    await this.applyThreshold(target);
    return { reported: true, alreadyReported: false };
  }

  /**
   * Masquage automatique quand le seuil de signalements distincts ouverts est atteint. Seuls
   * comptent les signalements de membres établis (`qualifyingReporter`) : quelques comptes
   * invités ou tout juste créés ne peuvent pas masquer un contenu ; leurs signalements restent
   * dans la file des opérateurs.
   */
  private async applyThreshold(target: TargetInfo): Promise<void> {
    if (target.reviewedAt) return; // déjà examiné par un opérateur : décision humaine seulement.
    const where = {
      ...(target.type === 'POST'
        ? { postId: target.id }
        : { commentId: target.id }),
      status: 'OPEN' as const,
      reporter: qualifyingReporter(),
    };
    const open = await this.prisma.communityReport.count({ where });
    if (open < hideThreshold()) return;
    const updated = await this.updateTarget(
      target.type,
      target.id,
      { status: 'HIDDEN_AUTO', hiddenAt: new Date() },
      { status: 'VISIBLE', reviewedAt: null },
    );
    if (updated === 0) return; // déjà masqué (course entre deux signalements)
    const { reporter: _qualifying, ...allOpen } = where;
    const total = await this.prisma.communityReport.count({ where: allOpen });
    const top = await this.prisma.communityReport.groupBy({
      by: ['reason'],
      where,
      _count: { _all: true },
      orderBy: { _count: { reason: 'desc' } },
      take: 1,
    });
    await this.record(
      {
        action: 'AUTO_HIDE',
        targetType: target.type,
        targetId: target.id,
        subjectId: target.authorId,
        operatorId: null,
        automated: true,
        reason: top[0]?.reason ?? null,
        statement: `Hidden automatically: ${open} distinct reports from established members (threshold ${hideThreshold()}). A moderator will review it.`,
        reportCount: total,
      },
      excerpt(target.body),
    );
  }

  // -------------------------------------------------------------------------
  // Décisions des opérateurs
  // -------------------------------------------------------------------------

  async hide(
    operatorId: string,
    type: ContentType,
    id: string,
    dto: ModerationDecisionDto,
  ) {
    const target = await this.requireTarget(type, id);
    await this.updateTarget(type, id, {
      status: 'HIDDEN_MODERATOR',
      hiddenAt: new Date(),
      reviewedAt: new Date(),
    });
    const closed = await this.closeReports(type, id, 'ACTIONED');
    const action = await this.record(
      {
        action: 'HIDE',
        targetType: type,
        targetId: id,
        subjectId: target.authorId,
        operatorId,
        reason: dto.reason,
        statement: cleanText(dto.statement),
        reportCount: closed.total,
      },
      excerpt(target.body),
    );
    await this.decideReports(closed.ids, action);
    return this.present(action);
  }

  async restore(
    operatorId: string,
    type: ContentType,
    id: string,
    dto: ModerationNoteDto,
  ) {
    const target = await this.requireTarget(type, id);
    await this.updateTarget(type, id, {
      status: 'VISIBLE',
      hiddenAt: null,
      reviewedAt: new Date(),
    });
    const closed = await this.closeReports(type, id, 'DISMISSED');
    const action = await this.record(
      {
        action: 'RESTORE',
        targetType: type,
        targetId: id,
        subjectId: target.authorId,
        operatorId,
        statement: cleanText(dto.statement),
        reportCount: closed.total,
      },
      // Un contenu jamais masqué n'a rien à « rétablir » : pas de notification inutile.
      target.status === 'VISIBLE' ? false : excerpt(target.body),
    );
    await this.decideReports(closed.ids, action);
    return this.present(action);
  }

  /** Classement sans suite des signalements ouverts ; le contenu ne sera plus masqué automatiquement. */
  async dismiss(
    operatorId: string,
    type: ContentType,
    id: string,
    dto: ModerationNoteDto,
  ) {
    const target = await this.requireTarget(type, id);
    await this.updateTarget(type, id, { reviewedAt: new Date() });
    const closed = await this.closeReports(type, id, 'DISMISSED');
    const action = await this.record(
      {
        action: 'DISMISS',
        targetType: type,
        targetId: id,
        subjectId: target.authorId,
        operatorId,
        statement: cleanText(dto.statement),
        reportCount: closed.total,
      },
      false,
    );
    await this.decideReports(closed.ids, action);
    return this.present(action);
  }

  async remove(
    operatorId: string,
    type: ContentType,
    id: string,
    dto: ModerationDecisionDto,
  ) {
    const target = await this.requireTarget(type, id);
    // Les signalements disparaissent avec le contenu (clé étrangère en cascade) : la décision
    // est consignée et notifiée aux auteurs des signalements AVANT la suppression.
    const closed = await this.closeReports(type, id, 'ACTIONED');
    const action = await this.record(
      {
        action: 'DELETE',
        targetType: type,
        targetId: id,
        subjectId: target.authorId,
        operatorId,
        reason: dto.reason,
        statement: cleanText(dto.statement),
        reportCount: closed.total,
      },
      excerpt(target.body),
    );
    await this.decideReports(closed.ids, action);
    if (type === 'POST') {
      const media = await this.prisma.communityMedia.findMany({
        where: { postId: id },
        select: { key: true },
      });
      await this.prisma.communityPost.deleteMany({ where: { id } });
      // Fichiers supprimés du stockage : l'URL publique cesse de fonctionner.
      await this.media.purgeKeys(media.map((m) => m.key));
    } else {
      await this.prisma.communityComment.deleteMany({ where: { id } });
    }
    return this.present(action);
  }

  async suspend(operatorId: string, handle: string, dto: SuspendDto) {
    const profile = await this.requireProfile(handle);
    const until = new Date(Date.now() + dto.days * DAY_MS);
    await this.setSuspension(profile.userId, until);
    return this.present(
      await this.record(
        {
          action: 'SUSPEND',
          targetType: 'USER',
          targetId: profile.userId,
          subjectId: profile.userId,
          operatorId,
          reason: dto.reason,
          statement: cleanText(dto.statement),
          suspendedUntil: until,
        },
        null,
      ),
    );
  }

  async unsuspend(operatorId: string, handle: string, dto: ModerationNoteDto) {
    const profile = await this.requireProfile(handle);
    await this.setSuspension(profile.userId, null);
    return this.present(
      await this.record(
        {
          action: 'UNSUSPEND',
          targetType: 'USER',
          targetId: profile.userId,
          subjectId: profile.userId,
          operatorId,
          statement: cleanText(dto.statement),
        },
        null,
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Files de travail des opérateurs
  // -------------------------------------------------------------------------

  /** Contenus visés par des signalements ouverts, du plus ancien signalement au plus récent. */
  async queue(limit = FEED_MAX_LIMIT, offset = 0) {
    const groups = await this.prisma.communityReport.groupBy({
      by: ['postId', 'commentId'],
      where: { status: 'OPEN' },
      _count: { _all: true },
      _min: { createdAt: true },
      orderBy: { _min: { createdAt: 'asc' } },
      take: Math.min(limit, FEED_MAX_LIMIT),
      skip: offset,
    });
    const items: Array<
      NonNullable<Awaited<ReturnType<typeof this.operatorContent>>> & {
        openReports: number;
        firstReportedAt: Date | null;
        reasons: Record<string, number>;
        details: {
          details: string | null;
          reason: CommunityReason;
          createdAt: Date;
        }[];
      }
    > = [];
    for (const g of groups) {
      const type: ContentType = g.postId ? 'POST' : 'COMMENT';
      const id = (g.postId ?? g.commentId)!;
      const where = g.postId ? { postId: id } : { commentId: id };
      const [content, reasons, details] = await Promise.all([
        this.operatorContent(type, id),
        this.prisma.communityReport.groupBy({
          by: ['reason'],
          where: { ...where, status: 'OPEN' },
          _count: { _all: true },
        }),
        this.prisma.communityReport.findMany({
          where: { ...where, status: 'OPEN', details: { not: null } },
          select: { details: true, reason: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);
      if (!content) continue;
      items.push({
        ...content,
        openReports: g._count._all,
        firstReportedAt: g._min.createdAt,
        reasons: Object.fromEntries(
          reasons.map((r) => [r.reason, r._count._all]),
        ),
        details,
      });
    }
    return { items, offset, limit };
  }

  /** Contenus masqués (automatiquement ou par un opérateur), les plus récents d'abord. */
  async hidden(limit = FEED_MAX_LIMIT) {
    const take = Math.min(limit, FEED_MAX_LIMIT);
    const hiddenWhere = { status: { not: 'VISIBLE' as const } };
    const [posts, comments] = await Promise.all([
      this.prisma.communityPost.findMany({
        where: hiddenWhere,
        orderBy: { hiddenAt: 'desc' },
        take,
        select: { id: true },
      }),
      this.prisma.communityComment.findMany({
        where: hiddenWhere,
        orderBy: { hiddenAt: 'desc' },
        take,
        select: { id: true },
      }),
    ]);
    const items = (
      await Promise.all([
        ...posts.map((p) => this.operatorContent('POST', p.id)),
        ...comments.map((c) => this.operatorContent('COMMENT', c.id)),
      ])
    ).filter((x): x is NonNullable<typeof x> => x !== null);
    items.sort(
      (a, b) => (b.hiddenAt?.getTime() ?? 0) - (a.hiddenAt?.getTime() ?? 0),
    );
    return { items: items.slice(0, take) };
  }

  /** Journal des décisions (curseur, plus récentes d'abord). */
  async log(cursorRaw: string | undefined, limit: number) {
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.communityModerationAction.findMany({
      where: afterCursor(cursor),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        subject: { select: { communityProfile: { select: { handle: true } } } },
        operator: {
          select: { communityProfile: { select: { handle: true } } },
        },
      },
    });
    const page = paginate(rows, limit);
    return {
      items: page.items.map((a) => ({
        ...this.present(a),
        targetId: a.targetId,
        subjectHandle: a.subject?.communityProfile?.handle ?? null,
        operatorHandle: a.operator?.communityProfile?.handle ?? null,
        operatorId: a.operatorId,
        reportCount: a.reportCount,
        notifiedAt: a.notifiedAt,
        appealText: a.appealText,
      })),
      nextCursor: page.nextCursor,
    };
  }

  /** Recours en attente (les plus anciens d'abord). */
  async pendingAppeals(limit = FEED_MAX_LIMIT) {
    const rows = await this.prisma.communityModerationAction.findMany({
      where: { appealStatus: 'PENDING' },
      orderBy: { appealedAt: 'asc' },
      take: Math.min(limit, FEED_MAX_LIMIT),
      include: {
        subject: { select: { communityProfile: { select: { handle: true } } } },
      },
    });
    return {
      items: await Promise.all(
        rows.map(async (a) => ({
          ...this.present(a),
          targetId: a.targetId,
          subjectHandle: a.subject?.communityProfile?.handle ?? null,
          appealText: a.appealText,
          content:
            a.targetType === 'USER'
              ? null
              : await this.operatorContent(a.targetType, a.targetId),
        })),
      ),
    };
  }

  async resolveAppeal(
    operatorId: string,
    actionId: string,
    dto: ResolveAppealDto,
  ) {
    const statement = cleanText(dto.statement);
    // Transition atomique PENDING → issue : une seule requête concurrente l'emporte ; elle seule
    // annule la décision et notifie l'auteur (ni double rétablissement ni double e-mail).
    const res = await this.prisma.communityModerationAction.updateMany({
      where: { id: actionId, appealStatus: 'PENDING' },
      data: {
        appealStatus: dto.outcome,
        appealResolvedAt: new Date(),
        appealStatement: statement,
      },
    });
    if (res.count !== 1) throw notFound();
    const updated =
      await this.prisma.communityModerationAction.findUniqueOrThrow({
        where: { id: actionId },
      });
    if (dto.outcome === 'REVERSED') {
      await this.revert(updated, operatorId, statement);
    }
    await this.notify(updated, null, dto.outcome);
    return this.present(updated);
  }

  /** Annule l'effet d'une décision contestée avec succès (si le contenu existe encore). */
  private async revert(
    action: CommunityModerationAction,
    operatorId: string,
    statement: string,
  ): Promise<void> {
    if (
      (action.action === 'HIDE' || action.action === 'AUTO_HIDE') &&
      action.targetType !== 'USER'
    ) {
      const type = action.targetType;
      const n = await this.updateTarget(
        type,
        action.targetId,
        { status: 'VISIBLE', hiddenAt: null, reviewedAt: new Date() },
        { status: { not: 'VISIBLE' } },
      );
      if (n > 0) {
        const closed = await this.closeReports(
          type,
          action.targetId,
          'DISMISSED',
        );
        const restore = await this.prisma.communityModerationAction.create({
          data: {
            action: 'RESTORE',
            targetType: type,
            targetId: action.targetId,
            subjectId: action.subjectId,
            operatorId,
            statement,
            reportCount: closed.total,
            // La réponse au recours tient lieu de notification.
            notifiedAt: new Date(),
          },
        });
        await this.decideReports(closed.ids, restore);
      }
    } else if (action.action === 'SUSPEND' && action.subjectId) {
      const n = await this.prisma.user.updateMany({
        where: {
          id: action.subjectId,
          communitySuspendedUntil: { not: null },
        },
        data: { communitySuspendedUntil: null },
      });
      await this.prisma.communityProfile.updateMany({
        where: { userId: action.subjectId },
        data: { suspendedUntil: null },
      });
      if (n.count > 0) {
        await this.prisma.communityModerationAction.create({
          data: {
            action: 'UNSUSPEND',
            targetType: 'USER',
            targetId: action.targetId,
            subjectId: action.subjectId,
            operatorId,
            statement,
            notifiedAt: new Date(),
          },
        });
      }
    }
    // DELETE : le contenu n'existe plus ; l'annulation est consignée et notifiée à l'auteur.
  }

  // -------------------------------------------------------------------------
  // Côté auteur : décisions reçues et recours
  // -------------------------------------------------------------------------

  async myDecisions(
    userId: string,
    cursorRaw: string | undefined,
    limit: number,
  ) {
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.communityModerationAction.findMany({
      where: {
        subjectId: userId,
        action: { not: 'DISMISS' },
        ...afterCursor(cursor),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = paginate(rows, limit);
    const existing = await this.existingTargets(page.items);
    return {
      items: page.items.map((a) => this.presentToSubject(a, existing)),
      nextCursor: page.nextCursor,
      contactEmail: communityContactEmail(),
    };
  }

  async myDecision(userId: string, actionId: string) {
    const action = await this.prisma.communityModerationAction.findFirst({
      where: { id: actionId, subjectId: userId, action: { not: 'DISMISS' } },
    });
    if (!action) throw notFound();
    const existing = await this.existingTargets([action]);
    return {
      ...this.presentToSubject(action, existing),
      contactEmail: communityContactEmail(),
    };
  }

  /**
   * Identifiants (publications, commentaires) des contenus visés qui existent encore. Une seule
   * requête par type pour toute la page.
   */
  private async existingTargets(
    actions: CommunityModerationAction[],
  ): Promise<Set<string>> {
    const ids = (type: 'POST' | 'COMMENT') =>
      actions.filter((a) => a.targetType === type).map((a) => a.targetId);
    const [posts, comments] = await Promise.all([
      this.prisma.communityPost.findMany({
        where: { id: { in: ids('POST') } },
        select: { id: true },
      }),
      this.prisma.communityComment.findMany({
        where: { id: { in: ids('COMMENT') } },
        select: { id: true },
      }),
    ]);
    return new Set([...posts, ...comments].map((r) => r.id));
  }

  /**
   * Décision vue par son destinataire. `target` dit toujours de quoi il s'agit (publication,
   * commentaire, profil) et si le contenu existe encore ; une fois supprimé, `targetId` passe à
   * null. Le contenu lui-même n'est jamais renvoyé (la décision ne conserve pas d'extrait) : le
   * motif de la décision et l'exposé des motifs en tiennent lieu.
   */
  private presentToSubject(
    a: CommunityModerationAction,
    existing: ReadonlySet<string>,
  ) {
    const exists = a.targetType === 'USER' || existing.has(a.targetId);
    const view = this.present(a);
    return {
      ...view,
      targetId: exists ? view.targetId : null,
      target: { type: a.targetType, exists },
    };
  }

  async appeal(userId: string, actionId: string, dto: AppealDto) {
    const action = await this.prisma.communityModerationAction.findFirst({
      where: { id: actionId, subjectId: userId },
    });
    if (!action) throw notFound();
    if (!this.canAppeal(action)) {
      throw badRequest(
        CommunityErrorCode.APPEAL_NOT_ALLOWED,
        'This decision cannot be appealed (already appealed, not appealable, or deadline passed).',
      );
    }
    const res = await this.prisma.communityModerationAction.updateMany({
      where: { id: actionId, appealStatus: 'NONE' },
      data: {
        appealStatus: 'PENDING',
        appealText: cleanText(dto.text),
        appealedAt: new Date(),
      },
    });
    if (res.count === 0) {
      throw badRequest(
        CommunityErrorCode.APPEAL_NOT_ALLOWED,
        'This decision has already been appealed.',
      );
    }
    return this.myDecision(userId, actionId);
  }

  /**
   * Mes signalements (DSA art. 16(5)) : statut (OPEN, ACTIONED, DISMISSED) et décision prise,
   * sans exposé des motifs ni identité de l'auteur du contenu. Un signalement disparaît avec le
   * contenu supprimé (sa décision a été notifiée par e-mail avant la suppression).
   */
  async myReports(
    userId: string,
    cursorRaw: string | undefined,
    limit: number,
  ) {
    await this.access.loadActor(userId);
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.communityReport.findMany({
      where: { reporterId: userId, ...afterCursor(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        postId: true,
        commentId: true,
        reason: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        decision: { select: { action: true, reason: true, createdAt: true } },
      },
    });
    const page = paginate(rows, limit);
    return {
      items: page.items.map((r) => ({
        id: r.id,
        targetType: r.postId ? ('POST' as const) : ('COMMENT' as const),
        targetId: (r.postId ?? r.commentId)!,
        reason: r.reason,
        reasonLabel: reasonLabel(r.reason, 'en'),
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        decision: r.decision
          ? {
              action: r.decision.action,
              contentRemoved: REMOVING_ACTIONS.includes(r.decision.action),
              reason: r.decision.reason,
              reasonLabel: reasonLabel(r.decision.reason, 'en'),
              decidedAt: r.decision.createdAt,
            }
          : null,
      })),
      nextCursor: page.nextCursor,
      contactEmail: communityContactEmail(),
    };
  }

  // -------------------------------------------------------------------------
  // Relance des notifications (job de maintenance)
  // -------------------------------------------------------------------------

  /**
   * Relance les notifications en échec de moins de NOTIFICATION_RETRY_DAYS jours (au plus
   * NOTIFICATION_RETRY_MAX_PER_RUN par catégorie) : décisions dont l'auteur n'a pas été notifié
   * (`notificationPending`), décisions non notifiées aux auteurs des signalements (`notifiedAt`
   * NULL). Un masquage devenu sans objet (contenu rétabli ou supprimé entre-temps) n'est plus
   * envoyé.
   */
  async retryNotifications(
    now: Date = new Date(),
  ): Promise<NotificationRetryCounts> {
    const since = new Date(now.getTime() - NOTIFICATION_RETRY_DAYS * DAY_MS);
    let decisions = 0;
    const pending = await this.prisma.communityModerationAction.findMany({
      where: { notificationPending: true, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: NOTIFICATION_RETRY_MAX_PER_RUN,
    });
    for (const action of pending) {
      let body: string | null = null;
      if (action.targetType !== 'USER') {
        const target = await this.loadTarget(
          action.targetType,
          action.targetId,
        );
        if (
          (action.action === 'AUTO_HIDE' || action.action === 'HIDE') &&
          (!target || target.status === 'VISIBLE')
        ) {
          await this.prisma.communityModerationAction.update({
            where: { id: action.id },
            data: { notificationPending: false },
          });
          continue;
        }
        body = target ? excerpt(target.body) : null;
      }
      const res = await this.notify(action, body);
      if (res.notifiedAt) decisions++;
    }
    const reports = await this.notifyReporters(
      {
        status: { not: 'OPEN' },
        resolvedAt: { gte: since },
      },
      NOTIFICATION_RETRY_MAX_PER_RUN,
    );
    return { decisions, reports };
  }

  // -------------------------------------------------------------------------
  // Outils internes
  // -------------------------------------------------------------------------

  /** Suspension portée par le compte (source de vérité), copiée sur le profil (affichage). */
  private async setSuspension(userId: string, until: Date | null) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { communitySuspendedUntil: until },
      }),
      this.prisma.communityProfile.updateMany({
        where: { userId },
        data: { suspendedUntil: until },
      }),
    ]);
  }

  /** Rattache les signalements clos à la décision et en informe leurs auteurs. */
  private async decideReports(
    reportIds: string[],
    action: CommunityModerationAction,
  ): Promise<void> {
    if (reportIds.length === 0) return;
    await this.prisma.communityReport.updateMany({
      where: { id: { in: reportIds } },
      data: { decisionId: action.id },
    });
    await this.notifyReporters({ id: { in: reportIds } }, reportIds.length);
  }

  /**
   * E-mail aux auteurs de signalements clos (DSA art. 16(5)), comptes avec adresse e-mail
   * seulement (un invité suit ses signalements dans l'application). `notifiedAt` n'est posé
   * qu'après un envoi réussi : les échecs sont relancés par la maintenance.
   */
  private async notifyReporters(
    where: Prisma.CommunityReportWhereInput,
    take: number,
  ): Promise<number> {
    const rows = await this.prisma.communityReport.findMany({
      where: {
        ...where,
        notifiedAt: null,
        decisionId: { not: null },
        reporter: { email: { not: null } },
      },
      orderBy: { createdAt: 'asc' },
      take,
      select: {
        id: true,
        postId: true,
        reason: true,
        createdAt: true,
        decision: { select: { action: true } },
        reporter: { select: { email: true, locale: true } },
      },
    });
    let sent = 0;
    for (const r of rows) {
      if (!r.decision || !r.reporter.email) continue;
      const rendered = renderReportDecision(r.reporter.locale, {
        targetType: r.postId ? 'POST' : 'COMMENT',
        reportReason: r.reason,
        reportedAt: r.createdAt,
        action: r.decision.action,
        contactEmail: communityContactEmail(),
      });
      const result = await this.mail.send({
        to: r.reporter.email,
        ...rendered,
      });
      if (!result.sent) {
        this.logger.warn(
          `Notification de décision au signalant non envoyée (signalement ${r.id}) : relance par la maintenance.`,
        );
        continue;
      }
      await this.prisma.communityReport.update({
        where: { id: r.id },
        data: { notifiedAt: new Date() },
      });
      sent++;
    }
    return sent;
  }

  private canAppeal(a: CommunityModerationAction, now = new Date()): boolean {
    return (
      APPEALABLE_ACTIONS.includes(a.action) &&
      a.appealStatus === 'NONE' &&
      appealDeadline(a.createdAt).getTime() > now.getTime()
    );
  }

  /** Vue d'une décision (auteur et opérateurs) ; jamais d'identifiant d'opérateur côté auteur. */
  present(a: CommunityModerationAction) {
    return {
      id: a.id,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetType === 'USER' ? null : a.targetId,
      reason: a.reason,
      reasonLabel: reasonLabel(a.reason, 'en'),
      statement: a.statement,
      automated: a.automated,
      suspendedUntil: a.suspendedUntil,
      createdAt: a.createdAt,
      appealStatus: a.appealStatus,
      appealDeadline: APPEALABLE_ACTIONS.includes(a.action)
        ? appealDeadline(a.createdAt)
        : null,
      canAppeal: this.canAppeal(a),
      appealStatement: a.appealStatement,
      appealResolvedAt: a.appealResolvedAt,
    };
  }

  /**
   * Consigne une décision et la notifie à l'auteur. `excerptOrSkip` : extrait du contenu visé,
   * null (pas d'extrait) ou false (pas de notification : classement, rétablissement sans effet).
   */
  private async record(
    data: Prisma.CommunityModerationActionUncheckedCreateInput,
    excerptOrSkip: string | null | false,
  ): Promise<CommunityModerationAction> {
    const notifies = excerptOrSkip !== false;
    const action = await this.prisma.communityModerationAction.create({
      data: { ...data, notificationPending: notifies && !!data.subjectId },
    });
    if (notifies) return this.notify(action, excerptOrSkip);
    return action;
  }

  /**
   * E-mail à l'auteur (s'il en a un) ; la décision reste consultable dans l'application. Un
   * envoi en échec laisse `notificationPending` à vrai : la maintenance relance.
   */
  private async notify(
    action: CommunityModerationAction,
    contentExcerpt: string | null,
    appealOutcome?: 'UPHELD' | 'REVERSED',
  ): Promise<CommunityModerationAction> {
    const user = action.subjectId
      ? await this.prisma.user.findUnique({
          where: { id: action.subjectId },
          select: { email: true, locale: true },
        })
      : null;
    if (!user?.email) {
      // Personne à joindre par e-mail (compte supprimé) : rien à relancer.
      if (!appealOutcome && action.notificationPending) {
        return this.prisma.communityModerationAction.update({
          where: { id: action.id },
          data: { notificationPending: false },
        });
      }
      return action;
    }
    const rendered = renderModerationDecision(user.locale, {
      action: action.action,
      targetType: action.targetType,
      reason: action.reason,
      statement: appealOutcome
        ? (action.appealStatement ?? action.statement)
        : action.statement,
      automated: action.automated && !appealOutcome,
      excerpt: contentExcerpt,
      suspendedUntil: action.suspendedUntil,
      decisionUrl: decisionUrl(action.id, user.locale),
      appealDeadline: appealDeadline(action.createdAt),
      contactEmail: communityContactEmail(),
      appealOutcome,
    });
    const result = await this.mail.send({ to: user.email, ...rendered });
    if (!result.sent) {
      this.logger.warn(
        `Notification de modération non envoyée (action ${action.id}) : consultable dans l'application.`,
      );
      return action;
    }
    if (appealOutcome) return action;
    return this.prisma.communityModerationAction.update({
      where: { id: action.id },
      data: { notifiedAt: new Date(), notificationPending: false },
    });
  }

  /**
   * Clôt les signalements ouverts du contenu ; renvoie le nombre total de signalements (journal)
   * et les identifiants des signalements clos par cette décision.
   */
  private async closeReports(
    type: ContentType,
    id: string,
    status: 'ACTIONED' | 'DISMISSED',
  ): Promise<{ total: number; ids: string[] }> {
    const where = type === 'POST' ? { postId: id } : { commentId: id };
    const total = await this.prisma.communityReport.count({ where });
    const open = await this.prisma.communityReport.findMany({
      where: { ...where, status: 'OPEN' },
      select: { id: true },
    });
    const ids = open.map((r) => r.id);
    if (ids.length > 0) {
      await this.prisma.communityReport.updateMany({
        where: { id: { in: ids }, status: 'OPEN' },
        data: { status, resolvedAt: new Date() },
      });
    }
    return { total, ids };
  }

  private async loadTarget(
    type: ContentType,
    id: string,
  ): Promise<TargetInfo | null> {
    if (type === 'POST') {
      const p = await this.prisma.communityPost.findUnique({
        where: { id },
        select: {
          id: true,
          authorId: true,
          status: true,
          body: true,
          reviewedAt: true,
        },
      });
      return p ? { type, ...p } : null;
    }
    const c = await this.prisma.communityComment.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        status: true,
        body: true,
        reviewedAt: true,
        post: { select: { id: true, status: true, authorId: true } },
      },
    });
    return c ? { type, ...c } : null;
  }

  private async requireTarget(type: ContentType, id: string) {
    const target = await this.loadTarget(type, id);
    if (!target) throw notFound();
    return target;
  }

  private async requireProfile(handle: string) {
    const profile = await this.prisma.communityProfile.findUnique({
      where: { handleKey: handleKey(handle) },
      select: { userId: true },
    });
    if (!profile) throw notFound();
    return profile;
  }

  /** Visible par `viewerId` : publié (et publication parente publiée), aucun blocage. */
  private async isVisibleTo(t: TargetInfo, viewerId: string): Promise<boolean> {
    if (t.authorId === viewerId) return true;
    if (t.status !== 'VISIBLE') return false;
    if (t.post && t.post.status !== 'VISIBLE' && t.post.authorId !== viewerId)
      return false;
    if (await this.access.isBlockedEitherWay(viewerId, t.authorId))
      return false;
    if (
      t.post &&
      (await this.access.isBlockedEitherWay(viewerId, t.post.authorId))
    )
      return false;
    return true;
  }

  private async updateTarget(
    type: ContentType,
    id: string,
    data: Prisma.CommunityPostUpdateManyMutationInput &
      Prisma.CommunityCommentUpdateManyMutationInput,
    extraWhere: {
      status?: CommunityContentStatus | { not: CommunityContentStatus };
      reviewedAt?: null;
    } = {},
  ): Promise<number> {
    const res =
      type === 'POST'
        ? await this.prisma.communityPost.updateMany({
            where: { id, ...extraWhere },
            data,
          })
        : await this.prisma.communityComment.updateMany({
            where: { id, ...extraWhere },
            data,
          });
    return res.count;
  }

  /** Contenu tel que le voit un opérateur (pseudo de l'auteur, jamais son e-mail). */
  private async operatorContent(type: ContentType, id: string) {
    if (type === 'POST') {
      const p = await this.prisma.communityPost.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          body: true,
          status: true,
          hiddenAt: true,
          reviewedAt: true,
          createdAt: true,
          media: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              key: true,
              width: true,
              height: true,
              alt: true,
            },
          },
          author: {
            select: { communityProfile: { select: { handle: true } } },
          },
        },
      });
      if (!p) return null;
      return {
        targetType: 'POST' as const,
        targetId: p.id,
        postId: p.id,
        postType: p.type,
        body: p.body,
        status: p.status,
        hiddenAt: p.hiddenAt,
        reviewedAt: p.reviewedAt,
        createdAt: p.createdAt,
        media: p.media.map((m) => this.media.view(m)),
        authorHandle: p.author.communityProfile?.handle ?? null,
      };
    }
    const c = await this.prisma.communityComment.findUnique({
      where: { id },
      select: {
        id: true,
        postId: true,
        body: true,
        status: true,
        hiddenAt: true,
        reviewedAt: true,
        createdAt: true,
        author: { select: { communityProfile: { select: { handle: true } } } },
      },
    });
    if (!c) return null;
    return {
      targetType: 'COMMENT' as const,
      targetId: c.id,
      postId: c.postId,
      postType: null,
      body: c.body,
      status: c.status,
      hiddenAt: c.hiddenAt,
      reviewedAt: c.reviewedAt,
      createdAt: c.createdAt,
      media: [],
      authorHandle: c.author.communityProfile?.handle ?? null,
    };
  }
}

/** Décisions qui retirent le contenu signalé (vue « Mes signalements »). */
const REMOVING_ACTIONS: readonly CommunityModerationActionType[] = [
  'AUTO_HIDE',
  'HIDE',
  'DELETE',
];

function excerpt(body: string): string | null {
  const text = body.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > EXCERPT_LENGTH
    ? `${text.slice(0, EXCERPT_LENGTH - 1)}…`
    : text;
}
