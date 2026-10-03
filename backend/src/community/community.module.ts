import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { CommunityAccessService } from './community-access.service';
import { CommunityDataService } from './community-data.service';
import { CommunityEnabledGuard } from './community-enabled.guard';
import { CommunityModerationController } from './community-moderation.controller';
import { CommunityModerationService } from './community-moderation.service';
import { CommunityPostsService } from './community-posts.service';
import { CommunityProfileService } from './community-profile.service';
import { CommunityController } from './community.controller';
import { CommunityMediaController } from './media/community-media.controller';
import { CommunityMediaService } from './media/community-media.service';
import { LocalMediaStorage } from './media/local-media-storage';
import { MEDIA_STORAGE, MediaStorage } from './media/media-storage';
import { S3MediaStorage } from './media/s3-media-storage';

/**
 * Pilote de stockage choisi par MEDIA_DRIVER (`local` par défaut, `s3` pour R2 / S3). En
 * production, COMMUNITY_ENABLED=true impose `s3` (validation Joi) : le disque Render est éphémère.
 */
export function createMediaStorage(): MediaStorage {
  return process.env.MEDIA_DRIVER === 's3'
    ? new S3MediaStorage()
    : new LocalMediaStorage();
}

/**
 * Communauté (volet social, phase 1 — backend). Toujours chargé : même désactivé
 * (COMMUNITY_ENABLED=false, routes en 404), il sert l'export et la suppression RGPD des données
 * communautaires et la purge des médias orphelins.
 */
@Module({
  imports: [MailModule],
  controllers: [
    CommunityController,
    CommunityModerationController,
    CommunityMediaController,
  ],
  providers: [
    { provide: MEDIA_STORAGE, useFactory: createMediaStorage },
    CommunityEnabledGuard,
    CommunityAccessService,
    CommunityMediaService,
    CommunityPostsService,
    CommunityProfileService,
    CommunityModerationService,
    CommunityDataService,
  ],
  exports: [CommunityDataService, CommunityMediaService, MEDIA_STORAGE],
})
export class CommunityModule {}
