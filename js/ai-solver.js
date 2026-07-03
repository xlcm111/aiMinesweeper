// =========================
// AI 求解器
// =========================

import { DIRECTIONS } from "./config.js";

export class AiSolver {
    /**
     * @param {Cell[][]} boardRef - AI 棋盘引用
     * @param {number} rows
     * @param {number} cols
     * @param {string} difficulty - AI 难度 key
     * @param {object} diffConfig - AI_DIFFICULTY[difficulty]
     */
    constructor(boardRef, rows, cols, difficulty, diffConfig) {
        this.board = boardRef;
        this.rows = rows;
        this.cols = cols;
        this.diff = diffConfig;
    }

    /** 获取某一格周围所有未翻开的邻居 */
    _getHiddenNeighbors(r, c) {
        const result = [];
        for (const [dr, dc] of DIRECTIONS) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                const cell = this.board[nr][nc];
                if (!cell.open) result.push(cell);
            }
        }
        return result;
    }

    /** 获取某一格周围已插旗的邻居 */
    _getFlaggedNeighbors(r, c) {
        const result = [];
        for (const [dr, dc] of DIRECTIONS) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                const cell = this.board[nr][nc];
                if (cell.flag) result.push(cell);
            }
        }
        return result;
    }

    /**
     * 执行一步推理
     * @returns {{ safe: Cell[], mines: Cell[] }}
     */
    deduce() {
        const safeCells = new Set();
        const mineCells = new Set();

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r][c];
                if (!cell.open || cell.mine || cell.number === 0) continue;

                const hidden = this._getHiddenNeighbors(r, c);
                const flagged = this._getFlaggedNeighbors(r, c);

                // 规则1: 数字 == 已插旗数 → 剩余未翻开格都是安全的
                if (cell.number === flagged.length && hidden.length > flagged.length) {
                    for (const h of hidden) {
                        if (!h.flag) safeCells.add(h);
                    }
                }

                // 规则2（仅中级及以上）: 数字 == 未翻开格总数 → 都是雷
                if (this.diff.useRule2 && cell.number === hidden.length && hidden.length > 0) {
                    for (const h of hidden) {
                        if (!h.flag) mineCells.add(h);
                    }
                }
            }
        }

        // 专家：模式识别（1-2-1 等定式）
        if (this.diff.patterns) {
            const patternResult = this._findPatterns();
            for (const h of patternResult.safe) safeCells.add(h);
            for (const h of patternResult.mines) mineCells.add(h);
        }

        return {
            safe: [...safeCells],
            mines: [...mineCells],
        };
    }

    /**
     * 模式识别：1-2-1 及其变体
     */
    _findPatterns() {
        const safeCells = new Set();
        const mineCells = new Set();

        const axes = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of axes) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const c1 = this.board[r]?.[c];
                    const c2 = this.board[r + dr]?.[c + dc];
                    const c3 = this.board[r + 2 * dr]?.[c + 2 * dc];
                    if (!c1 || !c2 || !c3) continue;
                    if (!c1.open || c1.mine || !c2.open || c2.mine || !c3.open || c3.mine) continue;
                    if (c1.number !== 1 || c2.number !== 2 || c3.number !== 1) continue;

                    const h2 = this._getHiddenNeighbors(c2.row, c2.col);
                    const h2NoFlag = h2.filter(h => !h.flag);
                    const pairCells = [c1, c3].filter(cc => !cc.open && !cc.flag);
                    if (h2NoFlag.length <= 3) {
                        for (const h of pairCells) {
                            if (!h.open && !h.flag) mineCells.add(h);
                        }
                        for (const h of h2NoFlag) {
                            if (!pairCells.includes(h)) safeCells.add(h);
                        }
                    }
                }
            }
        }

        return { safe: [...safeCells], mines: [...mineCells] };
    }

    /**
     * 获取所有未翻开且未插旗的格子
     */
    getUnknownCells() {
        const result = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r][c];
                if (!cell.open && !cell.flag) {
                    result.push(cell);
                }
            }
        }
        return result;
    }

    /**
     * 基于概率启发选择最佳猜测格
     */
    getBestGuess() {
        const unknowns = this.getUnknownCells();
        if (unknowns.length === 0) return null;

        let flaggedCount = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c].flag) flaggedCount++;
            }
        }
        const totalMines = this._countTotalMines();
        const remainingMines = totalMines - flaggedCount;

        const scored = unknowns.map(cell => {
            let dangerScore = 0;
            let adjacentOpenCount = 0;

            for (const [dr, dc] of DIRECTIONS) {
                const nr = cell.row + dr, nc = cell.col + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    const neighbor = this.board[nr][nc];
                    if (neighbor.open && !neighbor.mine && neighbor.number > 0) {
                        const nHidden = this._getHiddenNeighbors(nr, nc);
                        const nFlagged = this._getFlaggedNeighbors(nr, nc);
                        const nRemaining = nHidden.length - nFlagged.length;
                        if (nRemaining > 0) {
                            dangerScore += (neighbor.number - nFlagged.length) / nRemaining;
                            adjacentOpenCount++;
                        }
                    }
                }
            }

            if (adjacentOpenCount === 0) {
                dangerScore = unknowns.length > 0 ? remainingMines / unknowns.length : 0;
            } else {
                dangerScore /= adjacentOpenCount;
            }

            const isCorner = (cell.row === 0 || cell.row === this.rows - 1) &&
                             (cell.col === 0 || cell.col === this.cols - 1);
            const isEdge = cell.row === 0 || cell.row === this.rows - 1 ||
                           cell.col === 0 || cell.col === this.cols - 1;

            return { cell, dangerScore, isCorner, isEdge };
        });

        scored.sort((a, b) => {
            if (Math.abs(a.dangerScore - b.dangerScore) > 0.001) {
                return a.dangerScore - b.dangerScore;
            }
            if (a.isCorner !== b.isCorner) return a.isCorner ? -1 : 1;
            if (a.isEdge !== b.isEdge) return a.isEdge ? -1 : 1;
            return 0;
        });

        return scored[0].cell;
    }

    /** 统计棋盘中雷的总数 */
    _countTotalMines() {
        let count = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c].mine) count++;
            }
        }
        return count;
    }
}
