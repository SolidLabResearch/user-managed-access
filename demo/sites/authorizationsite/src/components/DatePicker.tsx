import React, { useRef, useState } from 'react';

function getDateCompatString(date: Date) {
    return date.toISOString().split('T')[0]
}

const DatePicker = (props: any) => {
    const [date, setDate] = useState(props.value)
    const dateInputRef = useRef(null);
  
    const onChange = (e: any) => {
        const date = new Date(e.target.value)
        setDate(date);
        props.onChange(date)
    };
  
    return (
      <div>
        <input
          type="date"
          onChange={onChange}
          value={getDateCompatString(date)}
          ref={dateInputRef}
        />
      </div>
    );
};
export default DatePicker
  
  