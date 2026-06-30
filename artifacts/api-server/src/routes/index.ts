import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mealsRouter from "./meals";
import youtubeRouter from "./youtube";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/meals", mealsRouter);
router.use("/youtube", youtubeRouter);

export default router;
