import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto, UpdateRoutineDto, CreateActionLogDto } from './dto/routine.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('routines')
@Controller('users/me/animals/:animalId/routines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new routine',
    description: 'Add a new routine for an animal',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiResponse({ status: 201, description: 'Routine created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your animal' })
  @ApiResponse({ status: 404, description: 'Animal not found' })
  async createRoutine(
    @Request() req,
    @Param('animalId') animalId: string,
    @Body() createRoutineDto: CreateRoutineDto,
  ) {
    return this.routinesService.createRoutine(
      req.user.id,
      animalId,
      createRoutineDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all routines for an animal',
    description: 'Retrieve all routines associated with an animal',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiResponse({ status: 200, description: 'Routines list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your animal' })
  @ApiResponse({ status: 404, description: 'Animal not found' })
  async findAllRoutines(@Request() req, @Param('animalId') animalId: string) {
    return this.routinesService.findAllRoutines(req.user.id, animalId);
  }

  @Get(':routineId')
  @ApiOperation({
    summary: 'Get a routine by ID',
    description: 'Retrieve detailed information about a specific routine',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'routineId', description: 'Routine ID' })
  @ApiResponse({ status: 200, description: 'Routine details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your routine' })
  @ApiResponse({ status: 404, description: 'Routine not found' })
  async findOneRoutine(
    @Request() req,
    @Param('animalId') animalId: string,
    @Param('routineId') routineId: string,
  ) {
    return this.routinesService.findOneRoutine(req.user.id, animalId, routineId);
  }

  @Patch(':routineId')
  @ApiOperation({
    summary: 'Update a routine',
    description: 'Update information about a specific routine',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'routineId', description: 'Routine ID' })
  @ApiResponse({ status: 200, description: 'Routine updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your routine' })
  @ApiResponse({ status: 404, description: 'Routine not found' })
  async updateRoutine(
    @Request() req,
    @Param('animalId') animalId: string,
    @Param('routineId') routineId: string,
    @Body() updateRoutineDto: UpdateRoutineDto,
  ) {
    return this.routinesService.updateRoutine(
      req.user.id,
      animalId,
      routineId,
      updateRoutineDto,
    );
  }

  @Delete(':routineId')
  @ApiOperation({
    summary: 'Delete a routine',
    description: 'Permanently delete a routine',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'routineId', description: 'Routine ID' })
  @ApiResponse({ status: 200, description: 'Routine deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your routine' })
  @ApiResponse({ status: 404, description: 'Routine not found' })
  async deleteRoutine(
    @Request() req,
    @Param('animalId') animalId: string,
    @Param('routineId') routineId: string,
  ) {
    return this.routinesService.deleteRoutine(req.user.id, animalId, routineId);
  }
}

@ApiTags('history')
@Controller('users/me/animals/:animalId/history')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HistoryController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Post()
  @ApiOperation({
    summary: 'Log an action',
    description: 'Record an action performed for an animal',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiResponse({ status: 201, description: 'Action logged' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your animal' })
  @ApiResponse({ status: 404, description: 'Animal not found' })
  async logAction(
    @Request() req,
    @Param('animalId') animalId: string,
    @Body() createActionLogDto: CreateActionLogDto,
  ) {
    return this.routinesService.logAction(req.user.id, animalId, createActionLogDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get action history',
    description: 'Retrieve action history for an animal',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max entries (default: 100)' })
  @ApiResponse({ status: 200, description: 'Action history' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your animal' })
  @ApiResponse({ status: 404, description: 'Animal not found' })
  async getHistory(
    @Request() req,
    @Param('animalId') animalId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    if (limit !== undefined && (limit < 1 || limit > 100)) {
      throw new BadRequestException('limit must be between 1 and 100');
    }
    return this.routinesService.getHistory(req.user.id, animalId, limit ?? 100);
  }

  @Delete(':logId')
  @ApiOperation({
    summary: 'Delete a history entry',
    description: 'Permanently delete a history entry',
  })
  @ApiParam({ name: 'animalId', description: 'Animal ID' })
  @ApiParam({ name: 'logId', description: 'History log ID' })
  @ApiResponse({ status: 200, description: 'History entry deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not your history entry' })
  @ApiResponse({ status: 404, description: 'History entry not found' })
  async deleteHistoryEntry(
    @Request() req,
    @Param('animalId') animalId: string,
    @Param('logId') logId: string,
  ) {
    return this.routinesService.deleteHistoryEntry(req.user.id, animalId, logId);
  }
}
