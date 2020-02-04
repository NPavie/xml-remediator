import React from "react";
import Transformer from "./Transformer";
import { Box } from "./Box";
import BoxFragment from "./BoxFragment";


interface BoxRemediationProperties{
    actions:Array<string>;
}

/**
 * 
 */
export default class BoxRemediation extends React.Component<BoxRemediationProperties>{
    // Actions are alledgedly functions from a "Transformation" object created for a document
    

    /**
     * Create a remediation scenario from a list of "Transformation" actions call
     * @param actions one or more string of a Transfomation call, i.e. "transformTable(true)"
     */
    constructor(props:BoxRemediationProperties){
        super(props)
    }

    /**
     * Apply the list of actions on a document and return an updated one
     * @param document document to be remediated
     * @param range fragment of the document to execute the remediation on
     */
    applyOn(document:Box, range:BoxFragment):Box{
        let transformation_chain = new Transformer(document)
            .moveTo(range.block,
                    range.size,
                    range.inline);
        this.props.actions.forEach((action)=>{
            let action_name = action.split('(')[0];
            let action_parameters = action.split('(')[1].split(')')[0].split(',').map((arg:string) => {return arg.trim()});
            let parsed_parameters = action_parameters.length > 0 ? 
                action_parameters.map((arg:string) => {
                        if(arg.startsWith("Transformer.")){
                            const property = arg.split('.')[1];
                            
                            return JSON.stringify(Transformer.H1);
                        } else return arg;
                    }).join(',') 
                : "";
            
            // recontextualize the action call in the transformation_chain
            // => add and bind "this" to transformation_chain object
            let actionCall = Function(`this.${action_name}(${parsed_parameters})`).bind(transformation_chain);
            
            actionCall();
        });
        
        return transformation_chain.get();
    }

    render(){
        let actions_list = this.props.actions.map((value:string) => {
            return <li>{value.replace('Transformer.','')}</li>;
        });
        return <ul>{actions_list}</ul>;
    }

}