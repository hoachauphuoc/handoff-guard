// Forge wraps a resolver's message as "ForgeAppError: There was an error invoking the function - <message>";
// only the message is meant for the person.
export const plainError = (e: unknown): string => String(e).replace(/^.*?invoking the function - /s, "").replace(/^(Forge)?(App)?Error: /, "");
