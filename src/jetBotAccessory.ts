import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { BasePlatformAccessory } from './basePlatformAccessory';
import { JetBotHomebridgePlatform } from './platform';
import { EventEmitter } from 'events';

export class JetBotData {
    battery: number;
    state: string;

    constructor(battery: number, state: string) {
        this.battery = battery;
        this.state = state;
    }
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class JetBotPlatformAccessory extends BasePlatformAccessory {
  private service: Service;
  private battery: Service;

  private logPrefix = '[' + this.accessory.displayName + ']';
  private events = new EventEmitter();

  // private log: Logger;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */

  constructor(
    platform: JetBotHomebridgePlatform,
    accessory: PlatformAccessory,
  ) {

    super(platform, accessory);

    // this.log = platform.log;

    this.service = accessory.getService(platform.Service.Fan) || accessory.addService(platform.Service.Fan);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(platform.Characteristic.Name, accessory.context.device.label);

    this.battery = this.accessory.getService(this.accessory.displayName + ' battery') ||
          this.accessory.addService(this.platform.Service.Battery, this.accessory.displayName + ' battery', 'Battery');

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

    this.battery.getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .onGet(this.getBatteryLevel.bind(this));
    this.battery.getCharacteristic(this.platform.Characteristic.ChargingState)
      .onGet(this.getChargingState.bind(this));
    this.battery.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .onGet(this.getStatusLowBattery.bind(this));

    this.events.on('update', (state: JetBotData) => {
      this.service.updateCharacteristic(this.platform.Characteristic.On, state.state == "cleaning");
      this.battery.updateCharacteristic(this.platform.Characteristic.BatteryLevel, state.battery || 0);
      this.battery.updateCharacteristic(this.platform.Characteristic.ChargingState, state.state == "charging" ? 1 : 0);
      this.battery.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, state.state == "charging" ? 0 : (state.battery < 20 ? 1 : 0));
    });

    const interval = setInterval(() => {
      this.platform.log.debug(this.logPrefix, 'Auto-Updating state');
      this.getStatus()
        .then(status => this.events.emit('update', status))
        .catch(err => this.platform.log.error(this.logPrefix, 'Failed To Auto Update State:\n', err));
    }, this.platform.config.RefreshInterval * 1000 || 60000);
    this.platform.api.on('shutdown', () => {
      clearInterval(interval);
    });
  }

  async getStatus(): Promise<JetBotData> {
      return new Promise<JetBotData>((resolve, reject) => {
        this.axInstance.get(this.statusURL).then(res => {
          let battery = res.data.components.main.battery.battery.value;
          let state = res.data.components.main.samsungce.robotCleanerOperatingState.operatingState.value;
          let data = new JetBotData(battery, state);
          this.platform.log.debug(this.logPrefix, "Received state:", data.battery, data.state);
          resolve(data);
        }).catch(() => {
          this.log.error('onSet FAILED for ' + this.name + '. Comm error');
          reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
        });
      });
  }

  /**
 * Handle "SET" requests from HomeKit
 * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
 */
  async setOn(value: CharacteristicValue): Promise<void> {
    this.log.debug('Received onSet(' + value + ') event for ' + this.name);

    return new Promise<void>((resolve, reject) => {
      if (!this.online) {
        this.log.debug(this.name + ' is offline');
        return reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
      }
      this.axInstance.post(this.commandURL, JSON.stringify([{
        capability: 'samsungce.robotCleanerOperatingState',
        command: 'setOperatingState',
        component: 'main',
        arguments: [value ? 'cleaning' : 'homing']
      }])).then(() => {
        this.log.debug('onSet(' + value + ') SUCCESSFUL for ' + this.name);
        resolve();
      }).catch(() => {
        this.log.error('onSet FAILED for ' + this.name + '. Comm error');
        reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
      });
    });
  }

  async getOn(): Promise<CharacteristicValue> {
    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    this.log.debug('Received onGet() event for ' + this.name);

    return new Promise<CharacteristicValue>((resolve, reject) => {
      if (!this.online) {
        this.log.error(this.accessory.context.device.label + ' is offline');
        return reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
      }
      this.getStatus()
        .then(status => resolve(status.state == "cleaning" ? 1 : 0))
        .catch(() => reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)));
    });
  }

  async getBatteryLevel(): Promise<CharacteristicValue> {
    this.log.debug('Received getBatteryLevel() onGet() event for ' + this.name);

    return new Promise<CharacteristicValue>((resolve, reject) => {
      if (!this.online) {
        this.log.error(this.accessory.context.device.label + ' is offline');
        return reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
      }
      this.getStatus()
        .then(status => resolve(status.battery))
        .catch(() => reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)));
    });
  }

  async getChargingState(): Promise<CharacteristicValue> {
    this.log.debug('Received getChargingState() onGet() event for ' + this.name);

    return new Promise<CharacteristicValue>((resolve, reject) => {
      if (!this.online) {
        this.log.error(this.accessory.context.device.label + ' is offline');
        return reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
      }
      this.getStatus()
        .then(status => resolve(status.state == "charging" ? 1 : 0))
        .catch(() => reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)));
    });
  }

  async getStatusLowBattery(): Promise<CharacteristicValue> {
    this.log.debug('Received getStatusLowBattery() onGet() event for ' + this.name);

    return new Promise<CharacteristicValue>((resolve, reject) => {
      if (!this.online) {
        this.log.error(this.accessory.context.device.label + ' is offline');
        return reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE));
      }
      this.getStatus()
        .then(status => resolve(status.state == "charging" ? 0 : (status.battery < 20 ? 1 : 0)))
        .catch(() => reject(new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE)));
    });
  }
}
