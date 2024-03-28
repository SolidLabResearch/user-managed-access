import React, { useState, useEffect }from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Fade from '@mui/material/Fade';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { TextField } from '@mui/material';
import DatePicker from './DatePicker';
import { PolicyFormData, terms } from '../util/PolicyManagement';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  height: 600,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

const purposeValues: Map<string, string> = new Map([
  ["age-verification", 'urn:solidlab:uma:claims:purpose:age-verification'],
  ["some-random-purpose", 'urn:solidlab:uma:claims:purpose:some-random-purpose']
]) 

const PolicyFormModal = (props: any) => {
  const [open, setOpen] = useState(false);

  let now = new Date()
  let end = new Date()
  end.setDate(end.getDate() + 7)
  
  const [target, setTarget] = useState<string>(terms.views.age);
  const [assignee, setAssignee] = useState<string>(terms.agents.vendor);
  const [startDate, setStartDate] = useState<Date>(now);
  const [endDate, setEndDate] = useState<Date>(end);
  const [purpose, setPurpose] = useState<string>('urn:solidlab:uma:claims:purpose:age-verification');
  const [description, setDescription] = useState<string>('Age verification for food store');

  const handleOpen = () => setOpen(true);
  const handleClose = () => { 
    setOpen(false) 
  };

  function commitPolicy(e: any) {
    e.preventDefault();
    handleClose()
    props.addPolicy({target, assignee, startDate, endDate, purpose, description} as PolicyFormData);
  }

  return (
    <div id="addPolicy">
      <button id='addPolicyButton' onClick={handleOpen}>Add Policy</button>
      {/* <Button onClick={handleOpen}>Open modal</Button> */}
      <Modal
        aria-labelledby="transition-modal-title"
        aria-describedby="transition-modal-description"
        open={open}
        onClose={handleClose}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 500,
          },
        }}
      >
        <Fade in={open}>
          <Box sx={style}>
            <h1>Add policy</h1>
            <form onSubmit={commitPolicy}>
              <label key='target'>target: <input value={target} readOnly/></label>
              <br />
              <label key='assignee'>assignee: <input value={assignee} readOnly/></label>
              <br />
              <label key='startdate'>start date:  <DatePicker value={startDate} onChange={(date: Date) => setStartDate(date)} /></label>
              <br />
              <label key='enddate'>end date:  <DatePicker value={endDate} onChange={(date: Date) => setEndDate(date) } /></label>
              <br />
              <label key='purpose'>purpose: 
                <select name='purpose' onChange={(e: any) => setPurpose(e.target.value)}>
                  {
                    Array.from(purposeValues.keys()).map(key => (
                      <option key={key} value={purposeValues.get(key)}>{key}</option>
                    ))
                  }
                </select>
              </label>
              <br />
              <label key='description'>description: <input value={description} onChange={(e:any) => setDescription(e.target.value)}/></label>
              
              <br />
              <br />
              <input type='submit' />
            </form>
          </Box>
        </Fade>
      </Modal>
    </div>
  );
}

// targetIRI: string, 
//   requestingPartyIRI: string, 
//   constraints?: { 
//     startDate?: Date, 
//     endDate?: Date, 
//     purpose?: string 
//   }


export default PolicyFormModal;