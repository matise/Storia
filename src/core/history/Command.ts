export interface Command {
  id: string;
  description: string;
  execute(): void;
  undo(): void;
  toJSON(): Record<string, unknown>;
}

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxDepth: number;

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  executeCommand(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo chain on new mutation
  }

  undo(): Command | undefined {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
    return command;
  }

  redo(): Command | undefined {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
    }
    return command;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  getUndoStack(): ReadonlyArray<Command> {
    return this.undoStack;
  }

  getRedoStack(): ReadonlyArray<Command> {
    return this.redoStack;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  serializeHistory(): {
    undo: Array<Record<string, unknown>>;
    redo: Array<Record<string, unknown>>;
  } {
    return {
      undo: this.undoStack.map((cmd) => cmd.toJSON()),
      redo: this.redoStack.map((cmd) => cmd.toJSON()),
    };
  }
}

