
export default class BoxFragment {
    // 0-based index of start block
    public block:number;
    // if non-negative, 0-based index of the start inline unit within the start block
    public inline:number;
    // number of blocks or inline units in the range
    public size:number;
    
    /**
     * 
     * @param start fragment start : an object {block:number, inline?:number} where
     * - block is the starting "final" (with no block children) block box index ;
     * - inline, if defined, is the starting inline within the selected block
     * @param size number of node to select at and after the specified start level 
     * (including the node pointed by the start parameter, so it cannot be less than 1)
     */
    constructor(start:{block:number, inline?:number}, size:number = 1) {
        if (start.block < 0) throw new Error('startBlockIndex cannot be negative');
        if (size < 1) throw new Error("BoxFragment size cannot be less than 1");
        this.block = start.block;
        this.inline = start.inline != null ? start.inline : -1;
        this.size = size;
    }

    get id(){
        return `b${this.block}${this.inline > -1 ? "-i"+this.inline : ""}-s${this.size}`;
    }

    equals(fragment:BoxFragment){
        return this.block === fragment.block && 
            this.inline === fragment.inline && 
            this.size === fragment.size;
    }

};