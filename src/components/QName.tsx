

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
	    this.prefix = from.prefix;
    }

    equals(name:QName){
        return (
            name.namespace == this.namespace 
                && name.localPart == this.localPart 
                && name.prefix == this.prefix);
    }

}

