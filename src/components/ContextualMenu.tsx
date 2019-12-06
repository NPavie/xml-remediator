import React from 'react';
import Box from './Box';
import Attribute from './Attribute';


interface ContextualProperties{
    selected_box?:Box;
    className?:string
}

export default class ContextualMenu extends React.Component<ContextualProperties> {
    
    constructor(props:ContextualProperties){
        super(props);
    }

    render(){
        // For a select box
        // Display its type and name
        // display its list of attributes
        // possible user actions : 
        // If it has children, offer to replace the block and/or some of thir children by another element
        if(this.props.selected_box){
            let box_props = this.props.selected_box.props;
            return (
                <div className={this.props.className}>
                    <strong>Contextual menu</strong><br/>
                    <p>{box_props.type === BoxType.BLOCK ? "Block" : "Inline"} {box_props.name ? box_props.name.localPart : "text"}</p>
                    <ul>{box_props.attributes.map((attr:Attribute)=>{
                        return (<li>@{attr.name.localPart}="{attr.value}"</li>);
                    })}</ul>
                </div>);
        }else {
           return (<div className={this.props.className}>
               <strong>Contextual menu</strong><br/>
               Select a block on the left to see contextual actions here
            </div>);
        }
        
    }
}