import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./logging.js";

const app = createApp();

app.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT
    },
    `custom-clickup backend listening on http://localhost:${config.PORT}`
  );
});
