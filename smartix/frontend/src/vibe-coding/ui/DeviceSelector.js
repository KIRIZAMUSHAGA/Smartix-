import React from 'react';

export const devices = [
  { name: 'Desktop', width: '100%', height: '100%', icon: '🖥' },
  { name: 'Tablette', width: '768px', height: '1024px', icon: '📱' },
  { name: 'Mobile', width: '375px', height: '667px', icon: '📱' },
  { name: 'Mobile Large', width: '428px', height: '926px', icon: '📱' },
  { name: 'Galaxy Fold', width: '280px', height: '653px', icon: '📱' },
];

const DeviceSelector = ({ selectedDevice, onSelect, rotate, onRotate }) => (
  <div className="device-toolbar">
    {devices.map(device => (
      <button
        key={device.name}
        className={selectedDevice.name === device.name ? 'active' : ''}
        onClick={() => onSelect(device)}
      >
        {device.icon} {device.name}
      </button>
    ))}
    <button onClick={onRotate}>
      🔄 Rotation {rotate ? 'ON' : 'OFF'}
    </button>
  </div>
);

export default DeviceSelector;