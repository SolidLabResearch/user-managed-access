import winston from 'winston';

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

const level = () => {
    const env = process.env.NODE_ENV || 'development'
    const isDevelopment = env === 'development'
    return isDevelopment ? 'debug' : 'warn'
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'magenta'
};

winston.addColors(colors);

const format = winston.format.combine(
    winston.format.cli(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (log) => `${log.timestamp} [${log.level}]: ${log.message}`
    ),
);

const transports = [
    new winston.transports.Console()
];

const logger = winston.createLogger({
    level: level(),
    levels,
    format,
    transports
});

export default logger;
