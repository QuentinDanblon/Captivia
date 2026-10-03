/**
 * CLI d'administration : attribue (ou retire) le rôle OPERATOR à un compte
 * EXISTANT. C'est le SEUL moyen d'obtenir le rôle opérateur (W0-01) : ni
 * l'inscription ni la variable OPERATOR_EMAILS n'accordent de droits.
 *
 * Usage (depuis backend/) :
 *   npm run operator:set -- <email>              promeut le compte en OPERATOR
 *   npm run operator:set -- <email> --revoke     rétrograde le compte en USER
 *   npm run operator:set -- --list               liste les opérateurs actuels
 *
 * Migration depuis OPERATOR_EMAILS : la migration SQL
 * 20261002100000_auth_roles_sessions ne PEUT PAS promouvoir les comptes listés
 * dans OPERATOR_EMAILS (variable d'environnement, invisible depuis SQL). Après
 * le déploiement, lancer ce script pour chaque opérateur légitime.
 * ATTENTION : avant W0-01, n'importe qui pouvait s'inscrire avec l'email d'un
 * opérateur (aucune vérification d'email). Vérifiez que le compte appartient
 * bien à la bonne personne (date de création, connexion de l'intéressé) avant
 * de le promouvoir ; en cas de doute, supprimez-le et faites-le recréer.
 *
 * Effet immédiat : le rôle est relu en base à chaque requête authentifiée.
 */
import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';

function usage(): never {
  console.error(
    'Usage : npm run operator:set -- <email> [--revoke]\n' +
      '        npm run operator:set -- --list',
  );
  process.exit(1);
}

async function main(prisma: PrismaClient): Promise<void> {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const positional = args.filter((a) => !a.startsWith('--'));
  const unknown = [...flags].filter((f) => f !== '--revoke' && f !== '--list');
  if (unknown.length > 0) usage();

  if (flags.has('--list')) {
    const operators = await prisma.user.findMany({
      where: { role: UserRole.OPERATOR },
      select: { email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    if (operators.length === 0) {
      console.log('Aucun opérateur.');
    }
    for (const op of operators) {
      console.log(`${op.email}\t(créé le ${op.createdAt.toISOString()})`);
    }
    return;
  }

  if (positional.length !== 1) usage();
  const email = positional[0].trim().toLowerCase();
  const role = flags.has('--revoke') ? UserRole.USER : UserRole.OPERATOR;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, createdAt: true, emailVerifiedAt: true },
  });
  if (!user) {
    console.error(
      `Aucun compte pour "${email}". Le compte doit d'abord être créé par inscription.`,
    );
    process.exit(2);
  }

  // W2-04 : le rôle opérateur exige une adresse e-mail vérifiée (possession prouvée).
  if (role === UserRole.OPERATOR && !user.emailVerifiedAt) {
    console.error(
      `"${email}" n'a pas vérifié son adresse e-mail. Demandez à l'intéressé de cliquer sur le lien de vérification avant de le promouvoir.`,
    );
    process.exit(3);
  }

  if (user.role === role) {
    console.log(`"${email}" a déjà le rôle ${role}. Rien à faire.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role } });
  console.log(
    `Rôle de "${email}" (compte créé le ${user.createdAt.toISOString()}) : ${user.role} -> ${role}.`,
  );
}

const prisma = new PrismaClient();
main(prisma)
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
