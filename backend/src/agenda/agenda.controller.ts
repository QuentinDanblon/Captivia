import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GuestForbidden, NoGuestGuard } from '../common/guest';
import { AgendaService } from './agenda.service';
import { AgendaFeedQueryDto, AgendaQueryDto } from './dto/agenda-query.dto';

@ApiTags('agenda')
@Controller('users/me')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get('agenda')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Agenda des soins',
    description:
      'Soins à venir de tous les animaux (routines, médicaments en cours, rappels de vaccin, RDV vétérinaires), triés par date. Période max 92 jours.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description:
      "YYYY-MM-DD, jour local du fuseau du compte (défaut : aujourd'hui)",
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'YYYY-MM-DD inclus (défaut : from + 29 jours)',
  })
  @ApiResponse({ status: 200, description: "Éléments de l'agenda" })
  @ApiResponse({
    status: 400,
    description: 'Bornes invalides ou période > 92 jours',
  })
  async getAgenda(@Request() req, @Query() query: AgendaQueryDto) {
    return this.agendaService.getAgenda(req.user.id, query.from, query.to);
  }

  @Get('agenda.ics')
  @ApiOperation({
    summary: "Flux iCalendar (RFC 5545) de l'agenda",
    description:
      "Authentifié par le jeton personnel `token` (révocable), pour l'abonnement depuis un calendrier externe.",
  })
  @ApiQuery({ name: 'token', required: true })
  @ApiResponse({ status: 200, description: 'text/calendar' })
  @ApiResponse({
    status: 401,
    description: 'Jeton absent, invalide ou révoqué',
  })
  async getFeed(
    @Query() query: AgendaFeedQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ics = await this.agendaService.getFeedByToken(query.token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="captivia-agenda.ics"',
    );
    // Le lien est un secret : jamais de cache partagé ni d'indexation.
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Robots-Tag', 'noindex');
    return ics;
  }

  @Get('agenda/calendar-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Un lien de calendrier est-il actif ? (le jeton lui-même n'est jamais relu)",
  })
  async getTokenStatus(@Request() req) {
    return { active: await this.agendaService.hasCalendarToken(req.user.id) };
  }

  @Post('agenda/calendar-token')
  @HttpCode(201)
  // Mode invité : s'abonner au flux ICS exige un compte (403 GUEST_ACCOUNT).
  @UseGuards(JwtAuthGuard, NoGuestGuard)
  @GuestForbidden('calendar_feed')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '(Re)génère le jeton du flux iCalendar',
    description:
      "Le jeton n'est renvoyé qu'une fois ; l'ancien lien est invalidé immédiatement.",
  })
  async regenerateToken(@Request() req) {
    const { token, feedPath } =
      await this.agendaService.regenerateCalendarToken(req.user.id);
    return { active: true, token, feedPath };
  }

  @Delete('agenda/calendar-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Révoque le jeton : le flux iCalendar cesse de fonctionner',
  })
  async revokeToken(@Request() req) {
    await this.agendaService.revokeCalendarToken(req.user.id);
    return { active: false };
  }
}
