import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnimalDto, UpdateAnimalDto } from './dto/animal.dto';
import { ensureAnimalOwnership } from '../common/helpers/ownership.helper';
import { effectivePremium } from '../common/operators';

const FREE_ANIMAL_LIMIT = 1;

/** Locales supportées pour construire l'URL publique (liste blanche, défaut : fr). */
export const PUBLIC_LINK_LOCALES = [
  'fr',
  'en',
  'es',
  'de',
  'it',
  'pt',
] as const;

/** Slug public : base64url, 10 à 64 caractères (les anciens slugs font 16 caractères alphanumériques). */
export const PUBLIC_SLUG_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;

export interface PublicLinkState {
  enabled: boolean;
  showHealth: boolean;
  slug: string | null;
  url: string | null;
}

/** Premium effectif : abonnement actif OU rôle opérateur (source unique : common/operators). */
export const isEffectivelyPremium = effectivePremium;

/** URL de base publique, construite côté serveur uniquement (jamais depuis le client). */
function publicWebBaseUrl(): string {
  const raw =
    (process.env.PUBLIC_WEB_URL || process.env.FRONTEND_URL || '').trim() ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

function normalizePublicLocale(locale?: string): string {
  const l = (locale || '').trim().toLowerCase();
  return (PUBLIC_LINK_LOCALES as readonly string[]).includes(l) ? l : 'fr';
}

function generatePublicSlug(): string {
  // 18 octets aléatoires = 144 bits, 24 caractères base64url
  return randomBytes(18).toString('base64url');
}

/** Sous-ensemble de PrismaService/transaction exposant animal.findUnique (parenté). */
type AnimalDelegate = {
  animal: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<{ userId: string; sex: string | null } | null>;
  };
};

const PARENT_SELECT = {
  id: true,
  name: true,
  sex: true,
  photos: true,
} as const;

@Injectable()
export class AnimalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createAnimalDto: CreateAnimalDto) {
    return this.prisma.$transaction(async (tx) => {
      // Verrou de ligne sur l'utilisateur : sérialise les créations concurrentes du même
      // compte, pour que la limite « 1 animal gratuit » ne puisse pas être contournée
      // par des requêtes parallèles (lecture du compteur + insertion non atomiques).
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
      `;
      if (!locked || locked.length === 0) {
        throw new NotFoundException('User not found');
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { _count: { select: { animals: true } } },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (
        !isEffectivelyPremium(user) &&
        user._count.animals >= FREE_ANIMAL_LIMIT
      ) {
        throw new ForbiddenException(
          'Free users can only have 1 animal. Upgrade to premium for unlimited animals.',
        );
      }

      // Module F — validation parenté (existence, même propriétaire, sexe)
      if (
        createAnimalDto.fatherId !== undefined &&
        createAnimalDto.fatherId !== null
      ) {
        await this.validateParent(
          tx,
          createAnimalDto.fatherId,
          userId,
          null,
          'male',
          'father',
        );
      }
      if (
        createAnimalDto.motherId !== undefined &&
        createAnimalDto.motherId !== null
      ) {
        await this.validateParent(
          tx,
          createAnimalDto.motherId,
          userId,
          null,
          'female',
          'mother',
        );
      }

      return tx.animal.create({
        data: {
          userId,
          speciesId: createAnimalDto.speciesId,
          name: createAnimalDto.name,
          birthDate: createAnimalDto.birthDate
            ? new Date(createAnimalDto.birthDate)
            : null,
          sex: createAnimalDto.sex || null,
          photos: createAnimalDto.photos || [],
          notes: createAnimalDto.notes || null,
          fatherId: createAnimalDto.fatherId ?? null,
          motherId: createAnimalDto.motherId ?? null,
          groupName: createAnimalDto.groupName ?? null,
        },
        include: {
          father: { select: PARENT_SELECT },
          mother: { select: PARENT_SELECT },
        },
      });
    });
  }

  async findAll(userId: string) {
    return this.prisma.animal.findMany({
      where: { userId },
      include: {
        routines: {
          where: { active: true },
          orderBy: { createdAt: 'desc' },
        },
        father: { select: PARENT_SELECT },
        mother: { select: PARENT_SELECT },
        _count: {
          select: {
            routines: true,
            history: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const animal = await this.prisma.animal.findUnique({
      where: { id },
      include: {
        routines: {
          orderBy: { createdAt: 'desc' },
        },
        history: {
          orderBy: { doneAt: 'desc' },
          take: 50,
        },
        father: { select: PARENT_SELECT },
        mother: { select: PARENT_SELECT },
      },
    });

    if (!animal) {
      throw new NotFoundException('Animal not found');
    }

    if (animal.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return animal;
  }

  async update(id: string, userId: string, updateAnimalDto: UpdateAnimalDto) {
    await ensureAnimalOwnership(this.prisma, id, userId);

    const updateData: Partial<{
      speciesId: number;
      name: string;
      birthDate: Date | null;
      sex: string | null;
      photos: string[];
      notes: string | null;
      fatherId: string | null;
      motherId: string | null;
      groupName: string | null;
    }> = {};

    if (updateAnimalDto.speciesId !== undefined) {
      updateData.speciesId = updateAnimalDto.speciesId;
    }
    if (updateAnimalDto.name !== undefined) {
      updateData.name = updateAnimalDto.name;
    }
    if (updateAnimalDto.birthDate !== undefined) {
      updateData.birthDate = updateAnimalDto.birthDate
        ? new Date(updateAnimalDto.birthDate)
        : null;
    }
    if (updateAnimalDto.sex !== undefined) {
      updateData.sex = updateAnimalDto.sex;
    }
    if (updateAnimalDto.photos !== undefined) {
      updateData.photos = updateAnimalDto.photos;
    }
    if (updateAnimalDto.notes !== undefined) {
      updateData.notes = updateAnimalDto.notes;
    }

    // Module F — parenté : validation avant écriture (null = effacer le lien)
    if (updateAnimalDto.fatherId !== undefined) {
      if (updateAnimalDto.fatherId !== null) {
        await this.validateParent(
          this.prisma,
          updateAnimalDto.fatherId,
          userId,
          id,
          'male',
          'father',
        );
      }
      updateData.fatherId = updateAnimalDto.fatherId;
    }
    if (updateAnimalDto.motherId !== undefined) {
      if (updateAnimalDto.motherId !== null) {
        await this.validateParent(
          this.prisma,
          updateAnimalDto.motherId,
          userId,
          id,
          'female',
          'mother',
        );
      }
      updateData.motherId = updateAnimalDto.motherId;
    }
    if (updateAnimalDto.groupName !== undefined) {
      updateData.groupName = updateAnimalDto.groupName ?? null;
    }

    return this.prisma.animal.update({
      where: { id },
      data: updateData,
      include: {
        father: { select: PARENT_SELECT },
        mother: { select: PARENT_SELECT },
      },
    });
  }

  /** Module F — portée : animaux dont fatherId ou motherId == id. */
  async getOffspring(id: string, userId: string) {
    await ensureAnimalOwnership(this.prisma, id, userId);

    return this.prisma.animal.findMany({
      where: { userId, OR: [{ fatherId: id }, { motherId: id }] },
      select: {
        id: true,
        name: true,
        sex: true,
        birthDate: true,
        photos: true,
        fatherId: true,
        motherId: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Module F — valide un parent potentiel :
   * - ne doit pas être l'animal lui-même (400)
   * - doit exister ET appartenir au même utilisateur (400)
   * - cohérence de sexe : père → male, mère → female (400 si sexe connu et
   *   différent ; 'unknown' / null accepté)
   */
  private async validateParent(
    prisma: AnimalDelegate,
    parentId: string,
    ownerId: string,
    animalId: string | null,
    expectedSex: 'male' | 'female',
    role: 'father' | 'mother',
  ): Promise<void> {
    if (animalId !== null && parentId === animalId) {
      throw new BadRequestException('An animal cannot be its own parent');
    }

    const parent = await prisma.animal.findUnique({
      where: { id: parentId },
    });

    if (!parent || parent.userId !== ownerId) {
      throw new BadRequestException('Parent must belong to the same owner');
    }

    if (parent.sex && parent.sex !== 'unknown' && parent.sex !== expectedSex) {
      throw new BadRequestException(
        role === 'father'
          ? 'Father must be a male animal'
          : 'Mother must be a female animal',
      );
    }
  }

  async remove(id: string, userId: string) {
    await ensureAnimalOwnership(this.prisma, id, userId);

    return this.prisma.animal.delete({
      where: { id },
    });
  }

  async getAnimalCount(userId: string): Promise<number> {
    return this.prisma.animal.count({
      where: { userId },
    });
  }

  private buildPublicUrl(slug: string, locale?: string): string {
    return `${publicWebBaseUrl()}/${normalizePublicLocale(locale)}/animal-public/${slug}`;
  }

  private toPublicLinkState(
    animal: {
      publicEnabled: boolean;
      publicShowHealth: boolean;
      publicSlug: string | null;
    },
    locale?: string,
  ): PublicLinkState {
    return {
      enabled: animal.publicEnabled,
      showHealth: animal.publicShowHealth,
      slug: animal.publicSlug,
      url: animal.publicSlug
        ? this.buildPublicUrl(animal.publicSlug, locale)
        : null,
    };
  }

  private async assertPremium(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPremium: true, role: true },
    });
    if (!user || !isEffectivelyPremium(user)) {
      throw new ForbiddenException(
        'Premium subscription required to share a public page for your animal.',
      );
    }
  }

  private async readPublicLinkState(
    animalId: string,
    locale?: string,
  ): Promise<PublicLinkState> {
    const fresh = await this.prisma.animal.findUnique({
      where: { id: animalId },
      select: { publicEnabled: true, publicShowHealth: true, publicSlug: true },
    });
    if (!fresh) throw new NotFoundException('Animal not found');
    return this.toPublicLinkState(fresh, locale);
  }

  /** État du lien public (sans effet de bord : ne crée jamais de slug). */
  async getPublicLink(
    animalId: string,
    userId: string,
    locale?: string,
  ): Promise<PublicLinkState> {
    const animal = await ensureAnimalOwnership(this.prisma, animalId, userId);
    return this.toPublicLinkState(animal, locale);
  }

  /**
   * Active / désactive le partage public et/ou l'affichage des vaccins.
   * Activer exige le premium ; désactiver est toujours possible.
   * Le slug est créé à la première activation. L'URL est construite côté serveur.
   */
  async updatePublicLink(
    animalId: string,
    userId: string,
    input: { enabled?: boolean; showHealth?: boolean },
    locale?: string,
  ): Promise<PublicLinkState> {
    const animal = await ensureAnimalOwnership(this.prisma, animalId, userId);

    if (input.enabled === true) {
      await this.assertPremium(userId);
    }

    const data: { publicEnabled?: boolean; publicShowHealth?: boolean } = {};
    if (input.enabled !== undefined) data.publicEnabled = input.enabled;
    if (input.showHealth !== undefined)
      data.publicShowHealth = input.showHealth;

    if (Object.keys(data).length > 0) {
      await this.prisma.animal.update({ where: { id: animalId }, data });
    }

    // Slug créé à la première activation (updateMany conditionnel : pas d'écrasement concurrent)
    if (input.enabled === true && !animal.publicSlug) {
      await this.assignNewSlug(animalId, false);
    }

    return this.readPublicLinkState(animalId, locale);
  }

  /** Génère un nouveau slug : l'ancien lien (QR imprimé) cesse immédiatement de fonctionner. */
  async regeneratePublicLink(
    animalId: string,
    userId: string,
    locale?: string,
  ): Promise<PublicLinkState> {
    await ensureAnimalOwnership(this.prisma, animalId, userId);
    await this.assertPremium(userId);
    await this.assignNewSlug(animalId, true);
    return this.readPublicLinkState(animalId, locale);
  }

  private async assignNewSlug(
    animalId: string,
    replaceExisting: boolean,
  ): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.prisma.animal.updateMany({
          where: replaceExisting
            ? { id: animalId }
            : { id: animalId, publicSlug: null },
          data: { publicSlug: generatePublicSlug() },
        });
        return;
      } catch (e) {
        // Collision d'unicité (probabilité négligeable) : on retente avec un autre slug
        if ((e as { code?: string })?.code !== 'P2002' || attempt === 2)
          throw e;
      }
    }
  }

  /**
   * Profil public (QR) — LISTE BLANCHE stricte. Jamais d'id interne, de notes, de details,
   * d'identité du propriétaire. 404 si le lien est inexistant, désactivé ou si le premium
   * du propriétaire a expiré.
   */
  async getPublicProfile(slug: string) {
    if (!PUBLIC_SLUG_PATTERN.test(slug)) {
      throw new NotFoundException('Animal not found');
    }

    const animal = await this.prisma.animal.findFirst({
      where: { publicSlug: slug, publicEnabled: true },
      select: {
        name: true,
        sex: true,
        birthDate: true,
        photos: true,
        publicShowHealth: true,
        user: { select: { isPremium: true, role: true } },
        speciesProfile: {
          select: { commonNameFr: true, scientificName: true },
        },
        vaccinations: {
          select: { name: true, date: true },
          orderBy: { date: 'desc' },
          take: 50,
        },
        healthRecords: {
          where: { type: 'vaccine' },
          select: { title: true, date: true },
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });

    if (!animal || !isEffectivelyPremium(animal.user)) {
      throw new NotFoundException('Animal not found');
    }

    const result: {
      name: string;
      species: { commonName: string; scientificName: string } | null;
      sex: string | null;
      birthYear: number | null;
      photo: string | null;
      vaccinations?: { name: string; date: Date }[];
    } = {
      name: animal.name,
      species: animal.speciesProfile
        ? {
            commonName: animal.speciesProfile.commonNameFr,
            scientificName: animal.speciesProfile.scientificName,
          }
        : null,
      sex: animal.sex,
      birthYear: animal.birthDate ? animal.birthDate.getUTCFullYear() : null,
      photo: animal.photos?.[0] ?? null,
    };

    if (animal.publicShowHealth) {
      const merged = [
        ...animal.vaccinations.map((v) => ({ name: v.name, date: v.date })),
        ...animal.healthRecords.map((r) => ({ name: r.title, date: r.date })),
      ];
      // Dédoublonnage nom + jour (un vaccin saisi dans les deux carnets)
      const seen = new Set<string>();
      result.vaccinations = merged
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .filter((v) => {
          const key = `${v.name.trim().toLowerCase()}|${v.date.toISOString().slice(0, 10)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }

    return result;
  }
}
