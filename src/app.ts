import express, { Application } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRoutes } from "./routes/authRoutes";
import { userRoutes } from "./routes/userRoutes";
import { workoutPlanRoutes } from "./routes/workoutPlanRoutes";
import { loggedIn, setCurrentUser } from "./middleware/auth";
import { workoutLogRoutes } from "./routes/workoutLogRoutes";
import { CLIENT_URL } from "./config/env";
import { exerciseRoutes } from "./routes/exerciseRoutes";

export const app: Application = express();

app.use(express.json());
app.use(cookieParser());
app.use(helmet());

switch (process.env.NODE_ENV) {
  case "production":
    app.use(cors({ credentials: true, origin: CLIENT_URL }));
    break;
  case "test":
    app.use(cors());
    break;
  case "development":
  default:
    app.use(morgan("dev"));
    app.use(cors({ credentials: true, origin: CLIENT_URL }));
}

app.use(setCurrentUser);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/workoutPlans", loggedIn, workoutPlanRoutes);
app.use("/workoutLogs", loggedIn, workoutLogRoutes);
app.use("/exercises", loggedIn, exerciseRoutes);
