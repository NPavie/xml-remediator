import React from "react";
import Transformer from "./Transformer";
import { Box } from "./Box";
import BoxFragment from "./BoxFragment";


/**
 * @param {string} function_call function call that can be bound to a transformer object (i.e. "transformTable(true)")
 * @param {boolean} is_activated wether this action should be used or not while remediation are applied
 */
interface Action{
    function_call:string,
    is_activated:boolean
}

/**
 * Properties of the component
 * @param {Array<Action>} actions array of Action 
 * @param {()=>void} onActionChangeCallback function called when an action checkbox changes
 */
interface BoxRemediationProperties{
    actions:Array<Action>;
    onActionChangeCallback?:(action_index:number)=>void
}

interface BoxRemediationprops{
    actions:Array<Action>;
}


/**
 * 
 */
export default class BoxRemediation extends React.Component<BoxRemediationProperties,BoxRemediationprops>{
    // Actions are alledgedly functions from a "Transformation" object created for a document

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
            if(action.is_activated){
                let action_name = action.function_call.split('(')[0];
                let action_parameters = action.function_call.split('(')[1].split(')')[0].split(',').map((arg:string) => {return arg.trim()});
                let parsed_parameters = action_parameters.length > 0 ? 
                    action_parameters.map((arg:string) => {
                            if(arg.startsWith("Transformer.")){
                                const property = arg.split('.')[1];
                                let transformer_property = undefined;
                                Object.entries(Transformer).forEach((value,index)=>{
                                    if(value[0] === property){
                                        transformer_property = value[1]
                                    }
                                });
                                return JSON.stringify(transformer_property);
                            } else return arg;
                        }).join(',') 
                    : "";
                
                // recontextualize the action call in the transformation_chain
                // => add and bind "this" to transformation_chain object
                let actionCall = Function(`this.${action_name}(${parsed_parameters})`).bind(transformation_chain);
                
                actionCall();
            }
        });
        
        return transformation_chain.get();
    }


    onActionChange(action_index:number){
        if(this.props.onActionChangeCallback) this.props.onActionChangeCallback(action_index);
    }

    

    render(is_activated?:boolean){
        
        let actions_list = this.props.actions.map((value:Action,index:number) => {
            return <li style={{listStyleType:"none",marginLeft:"10px"}} >
                <input type="checkbox" 
                        checked={this.props.actions[index].is_activated}
                        onChange={()=>{ this.onActionChange(index);}}
                        disabled={!is_activated}/>
                <label>{value.function_call.replace('Transformer.','')}</label></li>;
        });

        
        
        return <ul>{actions_list}</ul>;
    }

}