import React, { Fragment } from "react";

import { Box } from "./Box";

import './BoxTreeView.css';

interface BoxTreeProperties {
    box:Box;
    className?:string
    parent_hovered?:boolean;
    with_content?:boolean;
    onHoveringCallback?:(key:string,is_hovered:boolean)=>void
}

interface BoxTreeState {
    is_hovered:boolean
}

export default class BoxTreeView extends React.Component<BoxTreeProperties, BoxTreeState>{
    
    constructor(props:BoxTreeProperties){
        super(props);
        this.state = {
            is_hovered:false
        }
    }

    changeHovering(key?:string){
        let current_state = this.state;
        if(this.props.onHoveringCallback && key){
            this.props.onHoveringCallback(key, !current_state.is_hovered);
        }
		this.setState({
			is_hovered:!current_state.is_hovered
		});	
	}

    render(){
        // rendering the tree 
        let box = this.props.box;
        let pathes = box.key.split('/').slice(1);
        let block_level = pathes.length - 1;
        let level_indicator = "";
        for(let i = block_level; i--;){
            level_indicator += "---"
        }
        level_indicator += "| - ";
        let modifier = (this.state.is_hovered || this.props.parent_hovered) ? "--mouseover" : "";
        let rendered_children = new Array<JSX.Element>();
        for(let i = box.props.children.length; i--;){
            let b:Box = box.props.children[i];
            if(!b.props.virtual){
                rendered_children.unshift(<BoxTreeView 
                    box={b}
                    parent_hovered={this.state.is_hovered || this.props.parent_hovered}
                    with_content={this.props.with_content}
                    onHoveringCallback={this.props.onHoveringCallback}
                />);
            }    
        }
        
        let content:JSX.Element = <></>;
        let content_head:JSX.Element = <></>;
        if(this.props.with_content){
            content = <td className={"box__content"+modifier} >{box.props.text}</td>;
            content_head = <th className="boxlist__content">Content</th>;
        }

        if(block_level === 0) return (
                <div className="boxlist">
                <table className="boxlist__table">
                    <tbody>
                        <tr>
                            <th className="boxlist__data">Block</th>
                            {content_head}
                        </tr>
                        <tr >
                            <td className={"box__data"+modifier}
                                onMouseOver={(e:any)=>{this.changeHovering(box.key)}}
                                onMouseOut={(e:any)=>{this.changeHovering(box.key)}} >
                                {level_indicator + pathes.pop()}
                            </td>
                            {content}
                        </tr>
                        {rendered_children}
                    </tbody>
                </table></div>
            
        ); else return (
            <Fragment key={box.key}>
                <tr >
                    <td className={"box__data"+modifier}
                        onMouseOver={(e:any)=>{this.changeHovering(box.key)}}
                        onMouseOut={(e:any)=>{this.changeHovering(box.key)}} >
                        {level_indicator + pathes.pop()}
                    </td>
                    {content}
                </tr>	
                {rendered_children}
            </Fragment>);
    }
}