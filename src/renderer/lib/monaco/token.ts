import { IPosition } from 'monaco-editor';

interface IToken extends IPosition {
  readonly length: number;
  readonly type: number;
  readonly modifiers: number[];
}

export class TokenArray {
  private readonly tokens: IToken[] = [];

  public push(token: IToken) {
    this.tokens.push(token);
  }

  /**
   * Converts the token array to a raw Uint32Array for the semantic token provider. The array
   * contains the following data for each token:
   * - Line number offset from the previous token
   * - Column offset from the previous token
   * - Token length (number of characters)
   * - Token type (index in the semantic token legend)
   * - Token modifiers (bitmask of token modifiers in the semantic token legend)
   */
  public toUint32Array(): Uint32Array {
    const data = new Uint32Array(this.tokens.length * 5);

    let lastLine = 0;
    let lastColumn = 0;
    for (let i = 0; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      const offset = i * 5;
      data[offset] = token.lineNumber - lastLine;
      data[offset + 1] = token.column - lastColumn;
      data[offset + 2] = token.length;
      data[offset + 3] = token.type;
      data[offset + 4] = token.modifiers.reduce((acc, mod) => acc | mod, 0);

      if (token.lineNumber !== lastLine) {
        lastLine = token.lineNumber;
        lastColumn = 0;
      } else {
        lastColumn = token.column;
      }
    }

    return data;
  }
}
