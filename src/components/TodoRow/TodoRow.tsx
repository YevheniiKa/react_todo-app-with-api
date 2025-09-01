import React, { useRef, useState } from 'react';
import cn from 'classnames';
import { Todo } from '../../types/Todo';
import { Loader } from '../Loader';

type Props = {
  todo: Todo;
  onDelete?: () => Promise<void>;
  onRename?: (title: string) => Promise<void>;
  onToggleTodo?: () => Promise<void>;
  onCreateTodo?: (newTodo: string) => Promise<void>;
  onLoading: boolean;
};
export const TodoRow: React.FC<Props> = ({
  todo,
  onDelete = () => {},
  onRename = () => {},
  onToggleTodo = () => {},
  onLoading,
}) => {
  const [edited, setEdited] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // #region handlers
  const handleRemoveClick = async () => {
    try {
      await onDelete();
      setEdited(false);
    } catch {}
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = title.trim();

    if (trimmed === todo.title) {
      setEdited(false);

      return;
    }

    if (trimmed === '') {
      try {
        await onDelete();
        setEdited(false);
      } catch {
        setEdited(true);
        inputRef.current?.focus();
      }
    } else {
      try {
        await onRename(trimmed);
        setEdited(false);
      } catch {
        setEdited(true);
        inputRef.current?.focus();
      }
    }
  };

  const handleOnBlur = async () => {
    const trimmed = title.trim();

    if (trimmed === '') {
      try {
        await onDelete();
        setEdited(false);
      } catch {
        setEdited(true);
        inputRef.current?.focus();
      }

      return;
    }

    try {
      await onRename(trimmed);
      setEdited(false);
    } catch {
      setEdited(true);
      inputRef.current?.focus();
    }
  };

  const handleTodoStatusEdit = async () => {
    await onToggleTodo();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      inputRef.current?.blur();
      setTitle(todo.title);
      setEdited(false);
    }
  };

  // #endregion

  return (
    <>
      <div data-cy="Todo" className={cn('todo', { completed: todo.completed })}>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="todo__status-label">
          <input
            data-cy="TodoStatus"
            type="checkbox"
            className="todo__status"
            checked={todo.completed}
            onChange={handleTodoStatusEdit}
          />
        </label>

        {edited ? (
          <form onSubmit={handleEditSubmit}>
            <input
              data-cy="TodoTitleField"
              type="text"
              className="todo__title-field"
              placeholder="Empty todo will be deleted"
              value={title}
              ref={inputRef}
              onKeyDown={handleKeyDown}
              onChange={event => setTitle(event.target.value)}
              onBlur={handleOnBlur}
              autoFocus
            />
          </form>
        ) : (
          <>
            <span
              data-cy="TodoTitle"
              className="todo__title"
              onDoubleClick={() => setEdited(true)}
            >
              {todo.title}
            </span>

            <button
              type="button"
              className="todo__remove"
              data-cy="TodoDelete"
              onClick={handleRemoveClick}
              disabled={onLoading}
            >
              ×
            </button>
          </>
        )}
        <Loader loading={onLoading} />
      </div>
    </>
  );
};
