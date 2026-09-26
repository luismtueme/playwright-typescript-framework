# Runs the whole suite in the official Playwright image (browsers and system
# dependencies included), so results match CI on any machine.
#
#   docker compose run --rm tests                 everything, with MySQL
#   docker compose run --rm tests npm run check   any npm script
#
# Keep the image tag in step with @playwright/test in package.json.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

# Dependencies first, so code changes don't reinstall them
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV CI=true
CMD ["npm", "test"]
