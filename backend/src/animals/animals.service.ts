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

const FREE_ANIMAL_LIMIT = 1;

/** Sous-ensemble de PrismaService/transaction exposant animal.findUnique (parenté). */
type AnimalDelegate = { animal: { findUnique: (args: { where: { id: string } }) => Promise<{ userId: string; sex: string | null } | null> } };

const PARENT_SELECT = { id: true, name: true, sex: true, photos: true } as const;

@Injectable()
export class AnimalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createAnimalDto: CreateAnimalDto) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { _count: { select: { animals: true } } },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.isPremium && user._count.animals >= FREE_ANIMAL_LIMIT) {
        throw new ForbiddenException(
          'Free users can only have 1 animal. Upgrade to premium for unlimited animals.',
        );
      }

      // Module F — validation parenté (existence, même propriétaire, sexe)
      if (createAnimalDto.fatherId !== undefined && createAnimalDto.fatherId !== null) {
        await this.validateParent(
          tx,
          createAnimalDto.fatherId,
          userId,
          null,
          'male',
          'father',
        );
      }
      if (createAnimalDto.motherId !== undefined && createAnimalDto.motherId !== null) {
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

    if (
      parent.sex &&
      parent.sex !== 'unknown' &&
      parent.sex !== expectedSex
    ) {
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

  /** Get or create public link for QR (Premium only). Returns { slug, url } (url uses placeholder; frontend builds final URL). */
  async getOrCreatePublicLink(
    animalId: string,
    userId: string,
    baseUrl?: string,
  ): Promise<{ slug: string; url: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPremium: true },
    });
    if (!user?.isPremium) {
      throw new ForbiddenException('Premium subscription required to generate QR code for your animal.');
    }

    await this.findOne(animalId, userId);

    const animal = await this.prisma.animal.findUnique({
      where: { id: animalId },
      select: { publicSlug: true },
    });
    if (!animal) {
      throw new NotFoundException('Animal not found');
    }

    let slug = animal.publicSlug;
    if (!slug) {
      slug = randomBytes(12).toString('base64url').replace(/[-_]/g, 'x').slice(0, 16);
      await this.prisma.animal.update({
        where: { id: animalId },
        data: { publicSlug: slug },
      });
    }

    const base = (baseUrl || '').trim() || 'https://captivia.app';
    const url = `${base.replace(/\/$/, '')}/animal-public/${slug}`;
    return { slug, url };
  }
}
