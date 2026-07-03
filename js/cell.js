// =========================
// Cell 类 — 棋盘格子数据模型
// =========================

export class Cell {
    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.mine = false;
        this.number = 0;
        this.open = false;
        this.flag = false;
        this.element = null;
    }
}
