
import QName from './QName'

/**
 * Attribute json dto (from document json structure)
 */
export default interface Attribute{
    name:QName,
    value:string
}
