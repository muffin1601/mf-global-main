import React, { useState, useEffect } from 'react';
import "../../styles/crm/ToDoList.css";

const ToDoList = () => {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState("");
    const [editId, setEditId] = useState(null);
    const [editText, setEditText] = useState("");

    const handleAddTask = (e) => {
        e.preventDefault();
        if (newTask.trim() !== "") {
            setTasks([...tasks, { id: Date.now(), text: newTask.trim(), completed: false }]);
            setNewTask("");
        }
    };

    const handleDeleteTask = (id) => {
        setTasks(tasks.filter(task => task.id !== id));
    };

    const handleToggleComplete = (id) => {
        setTasks(tasks.map(task =>
            task.id === id ? { ...task, completed: !task.completed } : task
        ));
    };

    const handleEditTask = (id, text) => {
        setEditId(id);
        setEditText(text);
    };

    const handleSaveEdit = (id) => {
        setTasks(tasks.map(task =>
            task.id === id ? { ...task, text: editText } : task
        ));
        setEditId(null);
        setEditText("");
    };

    return (
        <div className="todo-card">
            <h2 className="todo-header">Tasks To Do</h2>
            <form onSubmit={handleAddTask} className="todo-input-form">
                <input
                    type="text"
                    className="todo-input"
                    placeholder="Add a new task..."
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                />
                <button type="submit" className="todo-add-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus">
                        <path d="M5 12h14" /><path d="M12 5v14" />
                    </svg>
                </button>
            </form>
            <ul className="todo-list">
                {tasks.map(task => (
                    <li key={task.id} className="todo-item">
                        {editId === task.id ? (
                            <div className="edit-mode">
                                <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="edit-input"
                                />
                                <button onClick={() => handleSaveEdit(task.id)} className="todo-action-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-save"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                                </button>
                            </div>
                        ) : (
                            <>
                                <span className={`task-text ${task.completed ? 'completed' : ''}`}>
                                    {task.text}
                                </span>
                                <div className="action-buttons">
                                    <button onClick={() => handleToggleComplete(task.id)} className="todo-action-button">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.5" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                    </button>
                                    <button onClick={() => handleEditTask(task.id, task.text)} className="todo-action-button">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                                    </button>
                                    <button onClick={() => handleDeleteTask(task.id)} className="todo-action-button">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                                    </button>
                                </div>
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};


export default ToDoList;
