

/** 
 * raw object interface for generic object cast 
 * @property {public string|undefined} namespace - namespace (xmlns) of the node
 * @property {public string|undefined} prefix - prefix associated to the namespace
 * @property {string} localPart -  local name of the node
 */
export interface QNameInterface{
    namespace?: string,
    prefix?: string,
    localPart: string
} 

/**
 * XML qualified name of a node according XML specification :
 * <prefix:localPart xlmns:prefix="namespace" />
 * @property {public string|undefined} namespace - namespace (xmlns) of the node
 * @property {public string|undefined} prefix - prefix associated to the namespace
 * @property {public string} localPart -  local name of the node
 */
export default class QName{
    public namespace?: string;
    public prefix?: string;
    public localPart: string;

    constructor(from:QName|QNameInterface){
        this.namespace = from.namespace;
	    this.localPart = from.localPart;
        this.prefix =  from.prefix != null ? from.prefix : "";
        // empty prefix should be considered "undefined"
        //if(this.prefix === "" || this.prefix == null) this.prefix = undefined;
    }

    /**
     * check object equality based on properties
     * @param name 
     */
    equals(name:QName | undefined | null){
        return name != null ? 
            (name.namespace === this.namespace 
                && name.localPart === this.localPart 
                && name.prefix === this.prefix) : 
            false;
    }

    /**
     * To string function (automatically called in console.log function on object)
     */
    toString(){
        let str:string = "";
        if(this.prefix) str = `${this.prefix}:`
        if(this.namespace) str += `{${this.namespace}}/`;
        str += this.localPart;
        return str;
    }

}

