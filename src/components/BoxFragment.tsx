



export default class BoxFragment {
    // 0-based index of start block
    public startBlockIndex:number;
    // if non-negative, 0-based index of the start inline unit within the start block
    public startInlineIndex:number;
    // number of blocks or inline units in the range
    public size:number;
    
    constructor(start:{block:number, inline?:number}, size:number = 1) {
        if (start.block < 0) throw new Error('startBlockIndex cannot be negative');
        if (size < 1) throw new Error("BoxFragment size cannot be less than 1");
        this.startBlockIndex = start.block;
        this.startInlineIndex = start.inline != null ? start.inline : -1;
        this.size = size;
    }
};