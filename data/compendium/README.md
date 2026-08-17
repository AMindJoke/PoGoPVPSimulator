# Judge Compendium content schemas

All identifiers use stable lowercase slugs (`fast-move-timing`, `dre`) so future search, deep links, and Scenario Review integrations do not depend on display titles.

Every JSON file has this envelope:

```json
{
  "schemaVersion": 1,
  "contentType": "mechanics | rulings | glossary",
  "items": []
}
```

## Mechanics

Required fields: `id`, `title`, `summary`, `category`, `keywords`, and `content`. Optional fields: `related` and `lastUpdated` (`YYYY-MM-DD`). `content` is an array of reusable sections:

```json
{
  "id": "duration-example",
  "heading": "Example",
  "kind": "text | key-point | example | steps",
  "body": ["One or more paragraphs or steps."]
}
```

## Rulings

Uses the Mechanics fields plus `source`, `sourceType` (`official`, `compendium`, or `mixed`), and optional `relatedMechanics`. Empty `source` is allowed for a Compendium explanation, but the source type must always be explicit. Do not copy official wording without deliberate sourcing and review.

## Glossary

Required fields: `id`, `term`, `definition`, and `keywords`. Optional fields: `expanded` and `related`.

The runtime validates every loaded dataset through `src/compendium/compendium-model.js`. Content updates therefore do not require changes to the Compendium renderer.
