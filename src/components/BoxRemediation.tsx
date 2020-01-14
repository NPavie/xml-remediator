import Transformation, { InputRange } from "./Transformation";
import { Box } from "./Box";

/**
 * 
 */
export default class BoxRemediation {
    // Actions are alledgedly functions from a "Transformation" object created for a document
    public actions:Array<string>;
    

    /**
     * Create a remediation scenario from a list of "Transformation" actions call
     * @param actions one or more string of a Transfomation call, i.e. "transformTable(true)"
     */
    constructor(...actions:string[]){
        this.actions = actions;
    }

    /**
     * Apply the list of actions on a document and return an updated one
     * @param document document to be remediated
     * @param range fragment of the document to execute the remediation on
     */
    applyOn(document:Box, range:InputRange):Box{
        let transformation_chain = new Transformation(document)
            .moveTo(range.startBlockIndex,
                    range.startInlineIndex,
                    range.size);

        this.actions.forEach((action)=>{
            // recontextualize the action call in the transformation_chain
            // => add and bind "this" to transformation_chain object
            let actionCall = new Function("this."+action).bind(transformation_chain);
            actionCall();
        });
        
        return transformation_chain.get();
    }


}