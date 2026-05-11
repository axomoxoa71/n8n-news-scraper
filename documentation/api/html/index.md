# Generated OpenAPI Documentation

## Static HTML Documentation

The OpenAPI specification is automatically built into interactive HTML documentation.

- **[View OpenAPI Documentation](news-scraper-openapi.html)** – Generated static HTML with full API reference

## Building Documentation

To regenerate the HTML from the OpenAPI YAML source:

```bash
npm run openapi:build
```

This builds `documentation/api/html/news-scraper-openapi.html` from `documentation/api/news-scraper-openapi.yaml`.

## Local Preview

For interactive Swagger UI preview during development:

```bash
npm run openapi:preview
```

Then open `http://127.0.0.1:8090` in your browser.

## Source Files

- OpenAPI Specification: [documentation/api/news-scraper-openapi.yaml](../news-scraper-openapi.yaml)
- API Documentation: [documentation/api/news-scraper-api.md](../news-scraper-api.md)
