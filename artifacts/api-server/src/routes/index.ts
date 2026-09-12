import { Router, type IRouter } from "express";
import healthRouter from "./health";
import corridorsRouter from "./corridors";

const router: IRouter = Router();

router.use(healthRouter);
router.use(corridorsRouter);

export default router;
