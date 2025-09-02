/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Todo } from './types/Todo';
import * as todoService from './api/todos';
import { TodoItem } from './components/TodoItem';
import { WarningError } from './components/WarningError';
import { USER_ID } from './utils/preferences';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import { UserWarning } from './UserWarning';
import { TodoFooter } from './components/TodoFooter';
import { TodoHeader } from './components/TodoHeader';
import { FilterType } from './utils/FilterType';

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [title, setTitle] = useState('');
  const [filter, setFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // #region loading
  const [loadingTodos, setLoadingTodos] = useState<number[]>([]);

  const startLoading = useCallback((id: number) => {
    setLoadingTodos(prev => [...prev, id]);
  }, []);

  const stopLoading = useCallback((id: number) => {
    setLoadingTodos(prev => prev.filter(todoId => todoId !== id));
  }, []);
  // #endregion

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 3000);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [todos.length]);

  useEffect(() => {
    todoService
      .getTodos()
      .then(setTodos)
      .catch(() => {
        showError('Unable to load todos');
      });
  }, [showError]);

  // #region deleteTodo

  const deleteTodo = useCallback(
    async (todoId: number) => {
      startLoading(todoId);

      try {
        await todoService.deleteTodo(todoId);
        setTodos(currentTodos =>
          currentTodos.filter(todo => todo.id !== todoId),
        );
      } catch (err) {
        showError('Unable to delete a todo');
        throw err;
      } finally {
        stopLoading(todoId);
      }
    },
    [startLoading, stopLoading, showError],
  );

  const handleDeleteAllCompletedTodos = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();

      const completedTodos = todos.filter(todo => todo.completed);

      completedTodos.forEach(todo => startLoading(todo.id!));

      try {
        const results = await Promise.allSettled(
          completedTodos.map(todo =>
            todoService.deleteTodo(todo.id!).then(() => todo.id),
          ),
        );

        const successfulIds: number[] = [];
        let hasError = false;

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            successfulIds.push(result.value);
          } else {
            hasError = true;
          }
        });

        setTodos(currentTodos =>
          currentTodos.filter(todo => !successfulIds.includes(todo.id!)),
        );

        if (hasError) {
          showError('Unable to delete a todo');
        } else {
          inputRef.current?.focus();
        }
      } finally {
        completedTodos.forEach(todo => stopLoading(todo.id!));
      }
    },
    [todos, startLoading, stopLoading, showError],
  );

  const handleDelete = useCallback(
    (id: number) => deleteTodo(id),
    [deleteTodo],
  );
  // #endregion

  // #region renameTodo
  const renameTodo = useCallback(
    async (todoToUpdate: Todo, newTitle: string) => {
      startLoading(todoToUpdate.id!);

      try {
        const updatedTodo = await todoService.updateTodo({
          ...todoToUpdate,
          title: newTitle.trim(),
        });

        setTodos(current =>
          current.map(todo =>
            todo.id === updatedTodo.id ? updatedTodo : todo,
          ),
        );

        return updatedTodo;
      } catch (err) {
        showError('Unable to update a todo');
        throw err;
      } finally {
        stopLoading(todoToUpdate.id!);
      }
    },
    [startLoading, stopLoading, showError],
  );

  const handleRename = useCallback(
    (todo: Todo, newTitle: string) => renameTodo(todo, newTitle),
    [renameTodo],
  );

  // #endregion

  // #region ToggleTodo
  const toggleTodo = useCallback(
    (todoToUpdate: Todo) => {
      startLoading(todoToUpdate.id!);

      return todoService
        .updateTodo({
          ...todoToUpdate,
          completed: !todoToUpdate.completed,
        })
        .then(updatedTodo => {
          setTodos(currentTodos =>
            currentTodos.map(todo =>
              todo.id === updatedTodo.id ? updatedTodo : todo,
            ),
          );
        })
        .catch(() => {
          showError('Unable to update a todo');
        })
        .finally(() => {
          stopLoading(todoToUpdate.id!);
        });
    },
    [startLoading, stopLoading, showError],
  );

  const toggleAllTodos = useCallback(async () => {
    const notCompletedTodos = todos.filter(todo => !todo.completed);
    const allCompleted = notCompletedTodos.length === 0;
    const todosToUpdate = allCompleted ? todos : notCompletedTodos;

    todosToUpdate.forEach(todo => startLoading(todo.id!));

    const updatedTodos = todos.map(todo =>
      todosToUpdate.includes(todo)
        ? { ...todo, completed: !allCompleted }
        : todo,
    );

    setTodos(updatedTodos);

    const results = await Promise.allSettled(
      todosToUpdate.map(todo =>
        todoService.updateTodo({ ...todo, completed: !allCompleted }),
      ),
    );

    const hasErrors = results.some(r => r.status === 'rejected');

    if (hasErrors) {
      showError('Unable to toggle some todos');
      const freshTodos = await todoService.getTodos();

      setTodos(freshTodos);
    }

    todosToUpdate.forEach(todo => stopLoading(todo.id!));
  }, [todos, startLoading, stopLoading, showError]);

  const handleToggle = useCallback(
    (todo: Todo) => toggleTodo(todo),
    [toggleTodo],
  );
  // #endregion

  // #region createTodo
  const createTodo = useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim();

      if (!trimmed) {
        return;
      }

      setIsCreating(true);

      const tempTodo: Todo & { isTemp: boolean } = {
        id: Date.now(),
        title: newTitle,
        completed: false,
        userId: USER_ID,
        isTemp: true,
      };

      setTodos(current => [...current, tempTodo]);
      startLoading(tempTodo.id);

      try {
        const newTodo = await todoService.createTodo(newTitle);

        setTodos(current =>
          current.map(todo => (todo.id === tempTodo.id ? newTodo : todo)),
        );

        setTitle('');

        setTimeout(() => inputRef.current?.focus(), 0);
      } catch {
        showError('Unable to add a todo');
        setTodos(current => current.filter(todo => todo.id !== tempTodo.id));
      } finally {
        stopLoading(tempTodo.id);
        setIsCreating(false);
      }
    },
    [startLoading, stopLoading, showError],
  );

  const handleCreateTodo = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') {
        return;
      }

      const trimmed = title.trim();

      if (!trimmed) {
        showError('Title should not be empty');

        return;
      }

      createTodo(trimmed);
    },
    [title, createTodo, showError],
  );

  // #endregion

  // #region filterTodos

  const handleFilter = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const value = event.currentTarget.getAttribute('href')?.slice(2) || '';

    setFilter(value);
  };

  const filteredTodos = useMemo(
    () =>
      todos.filter(todo => {
        switch (filter) {
          case FilterType.Active:
            return !todo.completed;
          case FilterType.Completed:
            return todo.completed;
          default:
            return true;
        }
      }),
    [todos, filter],
  );

  // #endregion

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <TodoHeader
          todos={todos}
          title={title}
          setTitle={setTitle}
          isCreating={isCreating}
          toggleAllTodos={toggleAllTodos}
          handleCreateTodo={handleCreateTodo}
          inputRef={inputRef}
        />
        <section className="todoapp__main" data-cy="TodoList">
          <TransitionGroup>
            {filteredTodos.map(todo => (
              <CSSTransition key={todo.id} timeout={300} classNames="item">
                <TodoItem
                  todo={todo}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onToggleTodo={handleToggle}
                  onLoading={loadingTodos.includes(todo.id!)}
                />
              </CSSTransition>
            ))}
          </TransitionGroup>
        </section>

        {todos.length > 0 && (
          <TodoFooter
            filter={filter}
            todos={todos}
            handleFilter={handleFilter}
            handleDeleteAllCompletedTodos={handleDeleteAllCompletedTodos}
          />
        )}
      </div>

      <WarningError
        errorMessage={errorMessage}
        onClose={() => setErrorMessage('')}
      />
    </div>
  );
};
