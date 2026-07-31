# @senlo/ui

Senlo Design System and UI Component Library.

## Installation

```bash
pnpm add @senlo/ui
```

## Setup

Import the styles in your main application file (e.g., `layout.tsx` or `_app.tsx`):

```tsx
import "@senlo/ui/styles.css";
```

## Usage

```tsx
import { Button, Card } from "@senlo/ui";

export default function MyComponent() {
  return (
    <Card>
      <Button variant="primary">Click Me</Button>
    </Card>
  );
}
```

## Development

### Local Development

If you are working inside the Senlo monorepo, you can use the workspace package directly.

### Building for Production

```bash
pnpm build
```

The build output will be in the `dist/` directory.

### Publishing

1. Update the version in `package.json`.
2. Run `pnpm build`.
3. Run `npm publish`.

## License

AGPL-3.0-or-later
