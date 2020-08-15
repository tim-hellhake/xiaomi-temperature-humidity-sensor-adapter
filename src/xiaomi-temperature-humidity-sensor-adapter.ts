/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter, Device, Property } from 'gateway-addon';

import noble from '@abandonware/noble';

import { readServiceData } from 'xiaomi-gap-parser';

export class TemperatureHumiditySensor extends Device {
  private temperatureProperty: Property;
  private humidityProperty: Property;

  constructor(adapter: Adapter, manifest: any, id: string) {
    super(adapter, `${manifest.display_name}-${id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor', 'HumiditySensor'];
    this.name = manifest.display_name;
    this.description = manifest.description;

    this.temperatureProperty = new Property(this, 'temperature', {
      type: 'number',
      '@type': 'TemperatureProperty',
      minimum: -127.99,
      maximum: 127.99,
      multipleOf: 0.1,
      unit: 'degree celsius',
      title: 'Temperature',
      description: 'The ambient temperature',
      readOnly: true
    });

    this.properties.set('temperature', this.temperatureProperty);

    this.humidityProperty = new Property(this, 'humidity', {
      type: 'number',
      '@type': 'HumidityProperty',
      minimum: 0,
      maximum: 100,
      multipleOf: 0.1,
      unit: '%',
      title: 'Humidity',
      description: 'The relative humidity',
      readOnly: true
    });

    this.properties.set('humidity', this.humidityProperty);
  }

  setData(serviceData: { uuid: string, data: Buffer }) {
    const result = readServiceData(serviceData.data);

    if (result.event && result.event.data) {
      const data = result.event.data;

      if (data.tmp) {
        const temperature = result.event.data.tmp;
        this.temperatureProperty.setCachedValueAndNotify(temperature);
      }

      if (data.hum) {
        const humidity = result.event.data.hum;
        this.humidityProperty.setCachedValueAndNotify(humidity);
      }
    }
  }
}

export class TemperatureHumiditySensorAdapter extends Adapter {
  private knownDevices: { [key: string]: TemperatureHumiditySensor } = {};

  constructor(addonManager: any, manifest: any) {
    super(addonManager, TemperatureHumiditySensorAdapter.name, manifest.name);
    addonManager.addAdapter(this);

    noble.on('stateChange', (state) => {
      console.log('Noble adapter is %s', state);

      if (state === 'poweredOn') {
        console.log('Start scanning for devices');
        noble.startScanning([], true);
      }
    });

    noble.on('discover', (peripheral) => {
      const serviceDataList = peripheral.advertisement.serviceData;

      if (serviceDataList && serviceDataList[0]) {
        const serviceData = serviceDataList[0];

        if (serviceData.uuid == 'fe95') {
          const id = peripheral.id;
          let knownDevice = this.knownDevices[id];
          const data = readServiceData(serviceData.data);

          if (!knownDevice) {
            console.log(`Detected new Temperature Humidity Sensor with id ${id}: ${JSON.stringify(data)}`);
            knownDevice = new TemperatureHumiditySensor(this, manifest, id);
            this.handleDeviceAdded(knownDevice);
            this.knownDevices[id] = knownDevice;
          }

          knownDevice.setData(serviceData);
        }
      }
    });
  }

  startPairing() {
    console.log('Start pairing');

    for (const id in this.knownDevices) {
      const device = this.knownDevices[id];
      this.handleDeviceAdded(device);
    }
  }

  cancelPairing() {
    console.log('Cancel pairing');
  }
}
