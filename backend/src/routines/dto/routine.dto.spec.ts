import { validateSync } from 'class-validator';
import {
  CreateRoutineDto,
  routineTypes,
  UpdateRoutineDto,
} from './routine.dto';

describe('CreateRoutineDto routine types', () => {
  it.each(routineTypes)('accepts the supported routine type %s', (type) => {
    const dto = Object.assign(new CreateRoutineDto(), {
      type,
      frequency: 'daily',
      schedule: { time: '08:00', recurrence: 'daily' },
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects unsupported routine types', () => {
    const dto = Object.assign(new CreateRoutineDto(), {
      type: 'unknown',
      frequency: 'daily',
      schedule: { time: '08:00', recurrence: 'daily' },
    });

    expect(validateSync(dto).some((error) => error.property === 'type')).toBe(
      true,
    );
  });
});

describe('UpdateRoutineDto routine types', () => {
  it.each(routineTypes)('accepts the supported routine type %s', (type) => {
    const dto = Object.assign(new UpdateRoutineDto(), { type });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects unsupported routine types', () => {
    const dto = Object.assign(new UpdateRoutineDto(), { type: 'unknown' });

    expect(validateSync(dto).some((error) => error.property === 'type')).toBe(
      true,
    );
  });
});
