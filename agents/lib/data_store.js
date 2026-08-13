const fs = require("fs");
const path = require("path");
const { z } = require("zod");

const { DATA_DIR } = require("./config");

const profileSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  business: z.string().min(1),
  username: z.string().min(1).optional(),
  bio: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["online", "offline"]).optional(),
});

const messageEntrySchema = z.object({
  from: z.string().min(1),
  text: z.string().min(1),
  time: z.string().min(1).optional(),
});

const messagesSchema = z.object({
  messages: z.array(messageEntrySchema),
});

const analyticsSchema = z.object({
  visits: z.number().int().nonnegative(),
  messages: z.number().int().nonnegative(),
  conversion_rate: z.number().min(0).max(1),
});

const FILE_SCHEMAS = {
  "profile.json": profileSchema,
  "messages.json": messagesSchema,
  "analytics.json": analyticsSchema,
};

const REQUIRED_FILES = Object.keys(FILE_SCHEMAS);

function loadJSON(filename, dataDir = DATA_DIR) {
  const filePath = path.join(dataDir, filename);
  const raw = fs.readFileSync(filePath, "utf8");
  const payload = JSON.parse(raw);
  return FILE_SCHEMAS[filename].parse(payload);
}

function getDataHealthReport(dataDir = DATA_DIR) {
  const files = {};
  const problems = [];

  for (const filename of REQUIRED_FILES) {
    const filePath = path.join(dataDir, filename);
    const report = {
      path: filePath,
      exists: fs.existsSync(filePath),
      valid_json: false,
      schema_valid: false,
    };

    if (!report.exists) {
      problems.push(`missing ${filePath}`);
      files[filename] = report;
      continue;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const payload = JSON.parse(raw);
      report.valid_json = true;
      FILE_SCHEMAS[filename].parse(payload);
      report.schema_valid = true;
    } catch (error) {
      if (error instanceof SyntaxError) {
        report.error = error.message;
        problems.push(`invalid JSON in ${filePath}: ${error.message}`);
      } else if (error.name === "ZodError") {
        report.error = error.issues[0].message;
        problems.push(`schema validation failed for ${filePath}: ${error.issues[0].message}`);
      } else {
        report.error = error.message;
        problems.push(`unable to load ${filePath}: ${error.message}`);
      }
    }

    files[filename] = report;
  }

  return {
    ok: problems.length === 0,
    data_dir: dataDir,
    files,
    problems,
  };
}

function validateDataDirectory(dataDir = DATA_DIR) {
  const problems = getDataHealthReport(dataDir).problems;

  if (problems.length > 0) {
    throw new Error(`Data integrity check failed: ${problems.join("; ")}`);
  }
}

module.exports = {
  DATA_DIR,
  REQUIRED_FILES,
  FILE_SCHEMAS,
  getDataHealthReport,
  loadJSON,
  validateDataDirectory,
};
