import { Request, Response, NextFunction } from "express";
import { ResponseError, ResponseMessage } from "../../@types";
import { userDocument } from "../models/user";
import {
  loggedSet,
  videoFileExtension,
  WorkoutLog,
  workoutLogDocument,
  workoutLogHeaderData,
} from "../models/workoutLog";
import { S3 } from "../config/aws";
import { WLOGGER_BUCKET } from "../../keys.json";
import { pipeline } from "stream";

export async function create(
  req: Request,
  res: Response<workoutLogDocument | ResponseError>
): Promise<void> {
  try {
    const workoutLog: workoutLogDocument = await WorkoutLog.create(req.body);
    const user = req.currentUser as userDocument;
    user.workoutLogs.unshift(workoutLog._id);
    await user.save();
    res.status(201).json(workoutLog);
  } catch (error) {
    const [, field, message]: string[] = error.message.split(": ");
    res.status(406).json({ field, error: message });
  }
}

export async function index(
  req: Request,
  res: Response<workoutLogHeaderData[] | ResponseMessage>
): Promise<void> {
  const user = req.currentUser as userDocument;
  await user.populate("workoutLogs").execPopulate();
  res.json(
    user.workoutLogs.map((workoutLog) =>
      workoutLog.generateWorkoutLogHeaderData()
    )
  );
}

export async function show(
  req: Request<{ id: string }>,
  res: Response<workoutLogDocument>
): Promise<void> {
  const { id } = req.params;
  const workoutLog: workoutLogDocument | null = (await WorkoutLog.findById(
    id
  )) as workoutLogDocument;
  res.json(workoutLog);
}

export async function destroy(
  req: Request,
  res: Response<string>
): Promise<void> {
  const user = req.currentUser as userDocument;
  const workoutLogToDelete = req.currentWorkoutLog as workoutLogDocument;
  const workoutLogToDeleteIndex:
    | number
    | undefined = user.workoutLogs.findIndex(
    (workoutLog: workoutLogDocument) =>
      workoutLog.toString() === workoutLogToDelete.id
  );
  user.workoutLogs.splice(workoutLogToDeleteIndex, 1);
  await Promise.all([
    workoutLogToDelete.deleteAllSetVideos(user.id),
    user.save(),
    workoutLogToDelete.delete(),
  ]);
  res.json(workoutLogToDelete.id);
}

export async function uploadSetVideo(
  req: Request,
  res: Response
): Promise<void> {
  const workoutLog = req.currentWorkoutLog as workoutLogDocument;
  for (let i = 0; i < req.files.length; ++i) {
    const file: Express.Multer.File = (req.files as Express.Multer.File[])[i];
    const fileParts: string[] = file.originalname.split(".");
    const [exerciseId, setId, fileExtension] = fileParts;
    const set = workoutLog.exercises
      .find((exercise) => exercise.id === exerciseId)
      ?.sets.find((set) => set.id === setId) as loggedSet;
    set.formVideo = {
      size: file.size,
      extension: fileExtension as videoFileExtension,
    };
  }
  await workoutLog.save();
  res.json();
}

export async function showSetVideo(
  req: Request<{ setId: string; exerciseId: string; id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const workoutLog = req.currentWorkoutLog as workoutLogDocument;
  const { setId, exerciseId } = req.params;
  const set: loggedSet | undefined = workoutLog.findSet(exerciseId, setId);
  if (!set || !set.formVideo) {
    res.status(404).json();
    return;
  }
  const fileExtension: videoFileExtension | undefined = set.formVideo.extension;
  const displayFileName = workoutLog.generateSetVideoDisplayFileName(
    exerciseId,
    setId
  );
  res.attachment(displayFileName);
  res.contentType(fileExtension);
  if (req.headers.range)
    writeVideoStreamHeaders(res, set.formVideo.size, req.headers.range);

  const videoKey: string = `${req.currentUser?.id}/${workoutLog.id}/${exerciseId}.${setId}.${fileExtension}`;
  const src = S3.getObject({
    Bucket: WLOGGER_BUCKET,
    Key: videoKey,
    Range: req.headers.range,
  }).createReadStream();

  pipeline(src, res, (err: NodeJS.ErrnoException | null) => {});
}

function writeVideoStreamHeaders(
  res: Response,
  totalFileSize: number,
  range: string
): void {
  // example range header: bytes=100-300
  const bytes = range.replace(/bytes=/, "").split("-");
  const rangeStart: number = parseInt(bytes[0], 10);
  const rangeEnd: number = bytes[1]
    ? parseInt(bytes[1], 10)
    : totalFileSize - 1;
  const chunkSize: number = rangeEnd - rangeStart + 1;

  const headers = {
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Range": `bytes ${rangeStart}-${rangeEnd}/${totalFileSize}`,
    "Content-Disposition": "inline",
  };

  res.writeHead(206, headers);
}

export async function destroySetVideo(
  req: Request<{ setId: string; exerciseId: string; id: string }>,
  res: Response<{ setId: string; exerciseId: string }>
): Promise<void> {
  const workoutLog = req.currentWorkoutLog as workoutLogDocument;
  const { setId, exerciseId } = req.params;
  const videoDeleted: boolean = await workoutLog.deleteSetVideo(
    exerciseId,
    setId,
    req.currentUser?.id
  );
  if (!videoDeleted) {
    res.status(404).json();
    return;
  }
  res.json({ setId, exerciseId });
}
