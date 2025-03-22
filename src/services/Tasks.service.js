import { ErrorService } from './Error.service.js';

export class TasksService {
    constructor() {
        this.STORAGE_KEY = 'tasks';
        this.BONUS_STORAGE_KEY = 'bonusMessages';
    }

    getTasks() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }

    isTaskCompleted(taskId) {
        const tasks = this.getTasks();
        return tasks[taskId]?.completed || false;
    }

    getBonusMessages() {
        const bonus = localStorage.getItem(this.BONUS_STORAGE_KEY);
        return parseInt(bonus || '0', 10);
    }

    addBonusMessages(count) {
        const current = this.getBonusMessages();
        const newTotal = current + count;
        localStorage.setItem(this.BONUS_STORAGE_KEY, newTotal.toString());
        this.updateBonusDisplay();
        return newTotal;
    }

    useBonusMessage() {
        const current = this.getBonusMessages();
        if (current > 0) {
            localStorage.setItem(this.BONUS_STORAGE_KEY, (current - 1).toString());
            this.updateBonusDisplay();
            return true;
        }
        return false;
    }

    updateBonusDisplay() {
        const bonusElement = document.getElementById('bonus-messages-count');
        const current = this.getBonusMessages();
        if (bonusElement) {
            bonusElement.textContent = `${current} bonus messages`;
        }
    }

    async completeTask(taskId) {
        const tasks = this.getTasks();
        if (tasks[taskId]?.completed) {
            return false;
        }

        tasks[taskId] = {
            completed: true,
            completedAt: new Date().toISOString()
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));

        if (taskId === 'task1') {
            this.addBonusMessages(20);
            const taskCard = document.getElementById(taskId);
            if (taskCard) {
                taskCard.classList.add('completed');
                taskCard.style.display = 'none'; // Permanently hide
            }
            return true;
        }
        return false;
    }
}

export const tasksService = new TasksService();
