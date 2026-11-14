import Dexie, { type EntityTable } from "dexie";
import type {
  BigThreeRecord,
  BodyWeightRecord,
  Exercise,
  InBodyRecord,
  SetItem,
  WorkoutSession,
} from "@/lib/types";

export class WorkoutDB extends Dexie {
  sessions!: EntityTable<WorkoutSession, "id">;
  exercises!: EntityTable<Exercise, "id">;
  sets!: EntityTable<SetItem, "id">;
  big_three!: EntityTable<BigThreeRecord, "id">;
  body_weight!: EntityTable<BodyWeightRecord, "id">;
  inbody_records!: EntityTable<InBodyRecord, "id">;

  constructor() {
    super("workout_db");
    this.version(1).stores({
      sessions: "id, date, month_key, target_muscle, sync_status, updated_at, deleted_at",
      exercises: "id, name, muscle_group, weight_type, sync_status, updated_at, deleted_at",
      sets: "id, session_id, exercise_id, set_order, set_type, sync_status, updated_at, deleted_at",
      big_three: "id, updated_at, sync_status",
    });
    this.version(2).stores({
      body_weight: "id, date, weight_kg, updated_at, sync_status",
    });
    this.version(3).stores({
      inbody_records: "id, date, timing, updated_at",
    });
  }
}

export const db = new WorkoutDB();
