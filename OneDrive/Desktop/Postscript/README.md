# PostScript
Postscript is a reader-to-reader connection app designed to foster meaningful conversations around books. Instead of focusing on recommendations or compatibility scores, it highlights shared reading experiences and thoughtful reflections to help readers discover one another and start genuine one-to-one conversations. 

flowchart TD
    A[Start App] --> B[User Login / Signup]

    B -->|New User| C[Create Profile]
    B -->|Existing User| D[Go to Discovery]

    C --> C1[Enter Basic Info<br/>(Name, Age, Location)]
    C1 --> C2[Add Reading Preferences<br/>(Genres, Authors, Top Books)]
    C2 --> C3[Answer Reflective Questions<br/>(Quote, Last Book, Character)]
    C3 --> D[Go to Discovery]

    D --> E[View Reader Profiles]
    E --> E1[See Shared Threads & Differences]
    E1 --> F{Open to Conversation?}

    F -->|Turn the Page| G[Wait for Mutual Interest]
    F -->|Skip| E

    G -->|Mutual| H[Conversation Unlocked]
    G -->|Not Mutual| E

    H --> I[Chat with Contextual Prompts]
    I --> D

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
