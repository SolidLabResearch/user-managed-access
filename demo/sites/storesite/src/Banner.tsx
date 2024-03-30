import React from 'react';
import './Banner.css';
import AuthModal from './Modal';

const Banner = (props: any) => {
	return (
		<div className='banner-wrapper'>
			<div className='row'>
				<div className='banner-header'>
					<div className='banner-headline'>
						<p>Some results have been hidden</p>
					</div>
				</div>
			</div>
			<div className='row'>
				<div className='column'>
					<p className='banner-text'>Please verify your age to display restricted items.</p>
				</div>
			</div>
            
            <AuthModal verify={props.verify} error={props.error} clearErrors={props.clearErrors}></AuthModal>
            {/* <button id='ageValidation' onClick={(e) => props.validationFunction()}>Validate</button> */}
		</div>
	);
}

export default Banner;