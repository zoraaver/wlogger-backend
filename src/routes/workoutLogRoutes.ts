import { Router } from "express";
import {
  S3WorkoutLogVideoUpload,
  setCurrentWorkoutLog,
} from "../middleware/workoutLog";
import * as workoutLogsController from "../controllers/workoutLogsController";
import { validateWorkoutLogId } from "../middleware/workoutLog";

export const workoutLogRoutes: Router = Router();

workoutLogRoutes.post(
  "/:id/videoUpload",
  validateWorkoutLogId,
  setCurrentWorkoutLog,
  S3WorkoutLogVideoUpload.array("formVideos", 5),
  workoutLogsController.uploadSetVideo
);

workoutLogRoutes.post("/", workoutLogsController.create);

workoutLogRoutes.get(
  "/:id/exercises/:exerciseId/sets/:setId/video",
  validateWorkoutLogId,
  setCurrentWorkoutLog,
  workoutLogsController.showSetVideo
);

workoutLogRoutes.get("/:id", validateWorkoutLogId, workoutLogsController.show);

workoutLogRoutes.get("/", workoutLogsController.index);

workoutLogRoutes.delete(
  "/:id/exercises/:exerciseId/sets/:setId/",
  validateWorkoutLogId,
  setCurrentWorkoutLog,
  workoutLogsController.destroySetVideo
);

workoutLogRoutes.delete(
  "/:id",
  validateWorkoutLogId,
  setCurrentWorkoutLog,
  workoutLogsController.destroy
);
