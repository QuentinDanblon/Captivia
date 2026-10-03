/**
 * Script développeur : réinitialise le mot de passe d'un utilisateur par email.
 * L'utilisateur doit déjà exister (créé via inscription ou seed).
 *
 * Usage (depuis backend/) :
 *   npm run reset-password -- <email> <nouveau_mot_de_passe>
 * Exemple :
 *   npm run reset-password -- dev@example.com <nouveau_mot_de_passe>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('reset-dev-password interdit en production');
  }
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: npx ts-node scripts/reset-dev-password.ts <email> <nouveau_mot_de_passe>');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('Le mot de passe doit contenir au moins 8 caractères.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

  if (!user) {
    console.error(`Aucun utilisateur trouvé pour l'email: ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  console.log(`Mot de passe mis à jour pour ${email}. Vous pouvez vous connecter avec ce nouveau mot de passe.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
