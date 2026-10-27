using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Threading;
using System.Web.Script.Serialization;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Foundation;
using Windows.Storage.Streams;

namespace Sp530eBleHelper
{
    class Program
    {
        private static readonly Guid ServiceUuid = new Guid("0000ffe0-0000-1000-8000-00805f9b34fb");
        private static readonly Guid CharacteristicUuid = new Guid("0000ffe1-0000-1000-8000-00805f9b34fb");

        private static BluetoothLEDevice _connectedDevice;
        private static GattCharacteristic _activeCharacteristic;
        private static JavaScriptSerializer _json = new JavaScriptSerializer();

        static void Main(string[] args)
        {
            Console.OutputEncoding = System.Text.Encoding.UTF8;
            SendLog("Sp530eBleHelper started and listening for IPC commands.");

            string line;
            while ((line = Console.ReadLine()) != null)
            {
                line = line.Trim();
                if (string.IsNullOrEmpty(line)) continue;

                try
                {
                    var req = _json.Deserialize<Dictionary<string, object>>(line);
                    int id = req.ContainsKey("id") ? Convert.ToInt32(req["id"]) : 0;
                    string method = req.ContainsKey("method") ? req["method"].ToString() : "";
                    Dictionary<string, object> parameters = req.ContainsKey("params") && req["params"] is Dictionary<string, object>
                        ? (Dictionary<string, object>)req["params"]
                        : new Dictionary<string, object>();

                    HandleRequest(id, method, parameters);
                }
                catch (Exception ex)
                {
                    SendError(0, "PARSE_ERROR", ex.Message);
                }
            }
        }

        private static void HandleRequest(int id, string method, Dictionary<string, object> parameters)
        {
            switch (method.ToLowerInvariant())
            {
                case "ping":
                    SendResponse(id, new Dictionary<string, object> { { "pong", true }, { "time", DateTime.UtcNow.ToString("o") } });
                    break;

                case "discover":
                    int timeoutMs = parameters.ContainsKey("timeoutMs") ? Convert.ToInt32(parameters["timeoutMs"]) : 5000;
                    DiscoverDevices(id, timeoutMs);
                    break;

                case "connect":
                    string addressStr = parameters.ContainsKey("address") ? parameters["address"].ToString() : "";
                    ConnectDevice(id, addressStr);
                    break;

                case "disconnect":
                    DisconnectDevice(id);
                    break;

                case "write":
                    string hex = parameters.ContainsKey("hex") ? parameters["hex"].ToString() : "";
                    WriteBytes(id, hex);
                    break;

                default:
                    SendError(id, "METHOD_NOT_FOUND", "Unknown IPC method: " + method);
                    break;
            }
        }

        private static void DiscoverDevices(int id, int timeoutMs)
        {
            var discovered = new Dictionary<string, Dictionary<string, object>>();
            var watcher = new BluetoothLEAdvertisementWatcher();
            watcher.ScanningMode = BluetoothLEScanningMode.Active;

            watcher.Received += (s, e) =>
            {
                string addr = e.BluetoothAddress.ToString("X12");
                string name = e.Advertisement.LocalName ?? "";
                short rssi = e.RawSignalStrengthInDBm;

                lock (discovered)
                {
                    discovered[addr] = new Dictionary<string, object>
                    {
                        { "address", addr },
                        { "name", name },
                        { "rssi", rssi },
                        { "isSP530E", name.IndexOf("SP530E", StringComparison.OrdinalIgnoreCase) >= 0 || name.IndexOf("SP630E", StringComparison.OrdinalIgnoreCase) >= 0 }
                    };
                }
            };

            watcher.Start();
            Thread.Sleep(timeoutMs);
            watcher.Stop();

            var list = new List<Dictionary<string, object>>();
            lock (discovered)
            {
                foreach (var item in discovered.Values)
                {
                    list.Add(item);
                }
            }

            SendResponse(id, new Dictionary<string, object> { { "devices", list } });
        }

        private static void ConnectDevice(int id, string addressHex)
        {
            try
            {
                ulong ulongAddr = ulong.Parse(addressHex.Replace(":", "").Replace("-", ""), NumberStyles.HexNumber);

                var opDev = BluetoothLEDevice.FromBluetoothAddressAsync(ulongAddr);
                var device = AwaitResult(opDev, 5000);

                if (device == null)
                {
                    SendError(id, "DEVICE_NOT_FOUND", "Could not locate device at address " + addressHex);
                    return;
                }

                _connectedDevice = device;

                var opServices = device.GetGattServicesForUuidAsync(ServiceUuid);
                var servicesRes = AwaitResult(opServices, 5000);

                if (servicesRes.Services.Count == 0)
                {
                    SendError(id, "SERVICE_NOT_FOUND", "SP530E GATT Service 0xFFE0 not found on device.");
                    return;
                }

                var service = servicesRes.Services[0];
                var opChars = service.GetCharacteristicsForUuidAsync(CharacteristicUuid);
                var charsRes = AwaitResult(opChars, 5000);

                if (charsRes.Characteristics.Count == 0)
                {
                    SendError(id, "CHAR_NOT_FOUND", "SP530E GATT Characteristic 0xFFE1 not found on service.");
                    return;
                }

                _activeCharacteristic = charsRes.Characteristics[0];

                // Subscribe to notifications
                _activeCharacteristic.ValueChanged += (sender, args) =>
                {
                    var reader = DataReader.FromBuffer(args.CharacteristicValue);
                    byte[] bytes = new byte[reader.UnconsumedBufferLength];
                    reader.ReadBytes(bytes);
                    string hex = BitConverter.ToString(bytes).Replace("-", "");

                    SendEvent("notification", new Dictionary<string, object>
                    {
                        { "hex", hex },
                        { "length", bytes.Length }
                    });
                };

                var opCccd = _activeCharacteristic.WriteClientCharacteristicConfigurationDescriptorAsync(
                    GattClientCharacteristicConfigurationDescriptorValue.Notify);
                AwaitResult(opCccd, 3000);

                SendResponse(id, new Dictionary<string, object>
                {
                    { "connected", true },
                    { "name", device.Name },
                    { "address", addressHex }
                });
            }
            catch (Exception ex)
            {
                SendError(id, "CONNECT_FAILED", ex.Message);
            }
        }

        private static void DisconnectDevice(int id)
        {
            try
            {
                if (_connectedDevice != null)
                {
                    _connectedDevice.Dispose();
                    _connectedDevice = null;
                }
                _activeCharacteristic = null;
                SendResponse(id, new Dictionary<string, object> { { "connected", false } });
            }
            catch (Exception ex)
            {
                SendError(id, "DISCONNECT_FAILED", ex.Message);
            }
        }

        private static void WriteBytes(int id, string hex)
        {
            if (_activeCharacteristic == null)
            {
                SendError(id, "NOT_CONNECTED", "Characteristic is not connected.");
                return;
            }

            try
            {
                byte[] raw = HexToBytes(hex);
                var writer = new DataWriter();
                writer.WriteBytes(raw);
                var buffer = writer.DetachBuffer();

                var opWrite = _activeCharacteristic.WriteValueWithResultAsync(buffer);
                var result = AwaitResult(opWrite, 3000);

                if (result.Status == GattCommunicationStatus.Success)
                {
                    SendResponse(id, new Dictionary<string, object>
                    {
                        { "success", true },
                        { "bytesWritten", raw.Length }
                    });
                }
                else
                {
                    SendError(id, "WRITE_FAILED", "GATT write failed with status: " + result.Status);
                }
            }
            catch (Exception ex)
            {
                SendError(id, "WRITE_EXCEPTION", ex.Message);
            }
        }

        private static byte[] HexToBytes(string hex)
        {
            hex = hex.Replace(" ", "").Replace("-", "");
            if (hex.Length % 2 != 0) throw new ArgumentException("Hex length must be even");
            byte[] bytes = new byte[hex.Length / 2];
            for (int i = 0; i < bytes.Length; i++)
            {
                bytes[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
            }
            return bytes;
        }

        private static T AwaitResult<T>(IAsyncOperation<T> op, int timeoutMs)
        {
            var evt = new ManualResetEvent(false);
            op.Completed = (info, status) => evt.Set();
            if (!evt.WaitOne(timeoutMs))
            {
                throw new TimeoutException("WinRT async operation timed out after " + timeoutMs + "ms");
            }
            if (op.Status != AsyncStatus.Completed)
            {
                throw new InvalidOperationException("WinRT async operation ended with status: " + op.Status);
            }
            return op.GetResults();
        }

        private static void SendResponse(int id, Dictionary<string, object> result)
        {
            var msg = new Dictionary<string, object>
            {
                { "id", id },
                { "result", result }
            };
            Console.WriteLine(_json.Serialize(msg));
        }

        private static void SendError(int id, string code, string message)
        {
            var msg = new Dictionary<string, object>
            {
                { "id", id },
                { "error", new Dictionary<string, object> { { "code", code }, { "message", message } } }
            };
            Console.WriteLine(_json.Serialize(msg));
        }

        private static void SendEvent(string eventName, Dictionary<string, object> parameters)
        {
            var msg = new Dictionary<string, object>
            {
                { "event", eventName },
                { "params", parameters }
            };
            Console.WriteLine(_json.Serialize(msg));
        }

        private static void SendLog(string message)
        {
            SendEvent("log", new Dictionary<string, object> { { "message", message }, { "timestamp", DateTime.UtcNow.ToString("o") } });
        }
    }
}
