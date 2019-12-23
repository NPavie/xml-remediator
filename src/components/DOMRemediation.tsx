import * as xmlserializer from 'xmlserializer';


/**
 * Remediation object interface
 * @member {string} pattern : xpath expression to select element to be remediated.
 * For exemple, "//*\[contains(&#x40;class,'CN')\]" selects all node that has an attribute "class" that contains the text 'CN'
 * @member {string} remapping : root node replacement
 * 
 */
export default class DOMRemediation {
    public pattern: string;

    // Proposition : actions as function calls in a string 
    // "rename('<h1 attr=\"blabla\">');"
    public actions:string;

    // Content used and updated by remediation functions (rename, unwrap and wrap)
    private content_document:Document = new Document();
    private nodes_to_remediate:Array<Node> = new Array<Node>();

    constructor(pattern:string,actions:string){
        this.pattern = pattern;
        this.actions = actions;
    }

    

    /**
     * For the current document and selected node to remediate, renames all the node in the document
     * @param new_tag the tag used to replace the pattern
     * @param attrs_to_keep the list (possibly empty) of attributes to retrieve from the replaced node.
     * if an empty array is provided, no attributes are retrieved. 
     * if the first element of the array is "all-attr-except" (default value of the array), 
     * all attributes are retrieved except the one following in the array
     *  
     */
    rename(new_tag:string, attrs_to_keep:string[] = ["all-attr-except"]){
        
        this.nodes_to_remediate.forEach((node) => {
            let element = node as Element;

            // Create the remapping node
            let remapped:Element = this.content_document.createElementNS(element.namespaceURI,new_tag);
            
            // only retrieve the attributes if the attr_to_keep array is not empty
            if(attrs_to_keep.length > 0) {
                element.getAttributeNames().forEach((attr) => {
                    // retrieve attribute only if 
                    // - the array starts with "all-attr-except" and does not contain the attribute (suppression mode)
                    // - the array does not start with "all-attr-except" and contains the attribute (acceptation mode)
                    if( (attrs_to_keep[0] === "all-attr-except" && attrs_to_keep.lastIndexOf(attr) == -1)
                            || (attrs_to_keep[0] !== "all-attr-except" && attrs_to_keep.lastIndexOf(attr) > 0)){
                        remapped.setAttribute(attr,element.getAttributeNode(attr)!.value);
                    }
                });
            }
            
            element.childNodes.forEach(child => {
                remapped.appendChild(child.cloneNode(true));
            });

            // replace node in parent
            let parent = element.parentNode;
            if(parent) parent.replaceChild(remapped,element);
            
        });
    }

    unwrap(){

    }

    wrap(wrapping_tag:string){

    }


    /**
     * Apply the remediation on the content and return the remediated content
     * @param content the input to be remediated
     * @returns the remediated content
     */
    applyOn(content:string, domparser_mode:SupportedType = "text/xml"):string{
        

        let parser = new DOMParser();
        this.content_document = parser.parseFromString(content,domparser_mode);
        
        let defaultNamespace = this.content_document.lookupNamespaceURI(null);
        let nsResolver = (prefix:string|null)=>{
            return this.content_document.lookupNamespaceURI(prefix) || defaultNamespace;
        };

        let match = this.content_document.evaluate( 
            this.pattern, 
            this.content_document.getRootNode(), 
            nsResolver,  
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,  //XPathResult.ORDERED_NODE_ITERATOR_TYPE
            null
        );

        /* for iterator use if snapshot does not work in future tests
        try {
            
            let node_found = match.iterateNext(); 
            while (node_found) {
                node_stack.push(node_found);
                console.log(node_found);
                node_found = match.iterateNext();
            }	
        }
        catch (e) {
            console.log( 'Error: Document tree modified during iteration - ' + e );
        } */
        // Snapshot-based node retrieval
        let len = match.snapshotLength;
        if(len > 0) while(len--){
            this.nodes_to_remediate.push(match.snapshotItem(len)!);
        }

        
        // rebind functions call in actions to this.
        let rewritedFunctionCall = "";
        this.actions.split(';').forEach((call)=>{
            rewritedFunctionCall += call.length > 0 ? "this."+call : "";
        });
        let actionsCall = new Function(rewritedFunctionCall).bind(this);
        actionsCall();
        
        
        
        // Convert back the document to xhtml
        //let serializer = new XMLSerializer();
        //console.log(serializer.serializeToString(this.content_document)); 
        
        return xmlserializer.serializeToString(this.content_document);
    }
}