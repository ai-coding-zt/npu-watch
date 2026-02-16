# npu-smi Commands Detailed Reference

Complete detailed reference for all npu-smi commands.

## Table of Contents

1. [Info Commands](#info-commands)
2. [Set Commands](#set-commands)
3. [Upgrade Commands](#upgrade-commands)
4. [Clear Commands](#clear-commands)
5. [AVI Commands](#avi-commands)
6. [Certificate Commands](#certificate-commands)

---

## Info Commands

### info -l (List Devices)

List all NPU devices in the system.

```bash
npu-smi info -l
```

**Output Example:**
```
+----------------------------------------------------------------------------------------+
| npu-smi 25.5.0                 Version: 25.5.0                                         |
+----------------------+-----------------+------------------------------------------------+
| NPU   Name           | Health          | Power(W)   Temp(C)                             |
| 0     xxx            | OK              | 15.0       40                                  |
+======================+=================+================================================+
```

---

### info -t health (Health Status)

Query device health status.

```bash
npu-smi info -t health -i <id>
```

**Parameters:**
- `id`: Device ID (integer)

**Output:**
- `Healthy`: OK, Warning, or Error

---

### info -t board (Board Info)

Query detailed board information.

```bash
npu-smi info -t board -i <id>
```

**Output Fields:**
| Field | Description |
|-------|-------------|
| NPU ID | Device identifier |
| Name | Device name |
| Health | Health status |
| Power Usage | Current power consumption |
| Temperature | Current temperature |
| Memory Usage | Memory usage statistics |
| AI Core Usage | AI Core utilization |
| Memory Frequency | Memory clock frequency |
| AI Core Frequency | AI Core clock frequency |

---

### info -t npu (Chip Info)

Query specific chip information.

```bash
npu-smi info -t npu -i <id> -c <chip_id>
```

**Parameters:**
- `id`: Device ID
- `chip_id`: Chip ID

---

### info -m (List All Chips)

Query all chips summary.

```bash
npu-smi info -m
```

---

### info -t temperature

Query chip temperature.

```bash
npu-smi info -t temperature -i <id> -c <chip_id>
```

**Output:**
- NPU Temperature
- AI Core Temperature

---

### info -t power

Query chip power consumption.

```bash
npu-smi info -t power -i <id> -c <chip_id>
```

**Output:**
- Power Usage (W)
- Power Limit (W)

---

### info -t memory

Query chip memory usage.

```bash
npu-smi info -t memory -i <id> -c <chip_id>
```

**Output:**
- Memory Usage (MB)
- Memory Total (MB)
- Memory Usage Rate (%)

---

### info -t processes

Query processes running on chip.

```bash
npu-smi info -t processes -i <id> -c <chip_id>
```

**Output:**
| Field | Description |
|-------|-------------|
| PID | Process ID |
| Process Name | Process name |
| Process Time | Process runtime |
| Memory Usage | Memory used by process |
| AI Core Usage | AI Core utilization |

---

### info -t ecc

Query ECC error information.

```bash
npu-smi info -t ecc -i <id> -c <chip_id>
```

**Output:**
- ECC Error Count
- ECC Mode Status

---

### info -t usages

Query chip utilization.

```bash
npu-smi info -t usages -i <id> -c <chip_id>
```

**Output:**
- AI Core Usage (%)
- Memory Usage (%)
- Bandwidth Usage (%)

---

### info -t sensors

Query sensor data.

```bash
npu-smi info -t sensors -i <id> -c <chip_id>
```

**Output:**
- Temperature sensors
- Voltage sensors
- Current sensors

---

### info -t freq

Query frequency information.

```bash
npu-smi info -t freq -i <id> -c <chip_id>
```

**Output:**
- AI Core Frequency (MHz)
- Memory Frequency (MHz)

---

### info -t p2p

Query P2P status.

```bash
npu-smi info -t p2p -i <id> -c <chip_id>
```

**Output:**
- P2P Status
- P2P Mode

---

### info -t pcie-info

Query PCIe information.

```bash
npu-smi info -t pcie-info -i <id> -c <chip_id>
```

**Output:**
- PCIe Speed
- PCIe Width

---

### info -t version

Query firmware version.

```bash
npu-smi info -t version -i <id> -c <chip_id>
```

**Output:**
- Firmware Version
- Driver Version

---

### info -t product

Query product information.

```bash
npu-smi info -t product -i <id> -c <chip_id>
```

**Output:**
- Product Name
- Product Serial Number

---

## Set Commands

### set -t temperature

Set temperature threshold.

```bash
npu-smi set -t temperature -i <id> -c <chip_id> -d <value>
```

**Parameters:**
- `value`: Temperature threshold in Celsius (integer)

---

### set -t power-limit

Set power limit.

```bash
npu-smi set -t power-limit -i <id> -c <chip_id> -d <value>
```

**Parameters:**
- `value`: Power limit in Watts (integer)

---

### set -t ecc-mode

Set ECC mode.

```bash
npu-smi set -t ecc-mode -i <id> -c <chip_id> -d <value>
```

**Parameters:**
- `value`: 0=disable, 1=enable

---

### set -t persistence-mode

Set persistence mode.

```bash
npu-smi set -t persistence-mode -i <id> -d <value>
```

**Parameters:**
- `value`: 0=disable, 1=enable

---

### set -t compute-mode

Set compute mode.

```bash
npu-smi set -t compute-mode -i <id> -c <chip_id> -d <value>
```

**Parameters:**
- `value`: 0=default, 1=exclusive, 2=prohibited

---

### set -t pwm-mode

Set fan mode.

```bash
npu-smi set -t pwm-mode -d <value>
```

**Parameters:**
- `value`: 0=manual, 1=automatic

---

### set -t pwm-duty-ratio

Set fan speed ratio.

```bash
npu-smi set -t pwm-duty-ratio -d <value>
```

**Parameters:**
- `value`: Speed ratio [0-100]

---

### set -t mac-addr

Set MAC address.

```bash
npu-smi set -t mac-addr -i <id> -c <chip_id> -d <mac_id> -s <mac_string>
```

**Parameters:**
- `mac_id`: 0=eth0, 1=eth1, 2=eth2, 3=eth3
- `mac_string`: MAC address format "XX:XX:XX:XX:XX:XX"

---

### set -t power-state

Set sleep state.

```bash
npu-smi set -t power-state -i <id> -c <chip_id> -d <value>
```

**Parameters:**
- `value`: Sleep time in ms [200, 604800000]

---

### set -t boot-select

Set boot medium.

```bash
npu-smi set -t boot-select -i <id> -c <chip_id> -d <value>
```

**Parameters:**
- `value`: 3=M.2 SSD, 4=eMMC

---

### set -t cpu-freq-up

Set CPU frequency.

```bash
npu-smi set -t cpu-freq-up -i <id> -d <value>
```

**Parameters:**
- `value`: 0=1.9GHz, 1=1.0GHz

---

### set -t sys-log-enable

Set log persistence.

```bash
npu-smi set -t sys-log-enable -d <mode>
```

**Parameters:**
- `mode`: 0=disable, 1=enable

---

### set -t sys-log-dump

Collect system logs.

```bash
npu-smi set -t sys-log-dump -s <level> -f <path>
```

**Parameters:**
- `level`: Log level [1-10]
- `path`: Absolute path for logs

---

### set -t clear-syslog-cfg

Clear log configuration.

```bash
npu-smi set -t clear-syslog-cfg
```

---

### set -t custom-op-secverify-enable

Set AI CPU custom op verification enable.

```bash
npu-smi set -t custom-op-secverify-enable -i <id> -d <value>
```

**Parameters:**
- `value`: 0=disable, 1=enable

---

### set -t custom-op-secverify-mode

Set AI CPU custom op verification mode.

```bash
npu-smi set -t custom-op-secverify-mode -i <id> -d <value>
```

**Parameters:**
- `value`: 0-7 (see mode table in SKILL.md)

---

### set -t op-timeout-cfg

Set AI CPU op timeout.

```bash
npu-smi set -t op-timeout-cfg -i <id> -c <chip_id> -d <value>
```

**Parameters:**
- `value`: Timeout value [20-32]

---

### set -t custom-op-secverify-cert

Set AI CPU custom op verification certificate.

```bash
npu-smi set -t custom-op-secverify-cert -i <id> -f "<cert_path>"
```

**Parameters:**
- `cert_path`: Certificate file path(s)

---

### set -t p2p-mem-cfg

Set P2P memory copy configuration.

```bash
npu-smi set -t p2p-mem-cfg -i <id> [-c <chip_id>] -d <value>
```

**Parameters:**
- `value`: 0=disable, 1=enable

---

## Upgrade Commands

### upgrade -q (Query Status)

Query firmware upgrade status.

```bash
npu-smi upgrade -q <item> -i <id>
```

**Parameters:**
- `item`: mcu, bootloader, vrd
- `id`: Device ID

---

### upgrade -b (Query Version)

Query firmware version.

```bash
npu-smi upgrade -b <item> -i <id>
```

---

### upgrade -t (Upgrade)

Upgrade firmware.

```bash
npu-smi upgrade -t <item> -i <id> -f <file_path>
```

**Parameters:**
- `item`: mcu, bootloader, vrd
- `file_path`: Firmware file path (not needed for vrd)

---

### upgrade -a (Activate)

Activate firmware.

```bash
npu-smi upgrade -a <item> -i <id>
```

---

## Clear Commands

### clear -t ecc-info

Clear ECC error count.

```bash
npu-smi clear -t ecc-info -i <id> [-c <chip_id>]
```

---

### clear -t tls-cert-period

Restore default certificate expiration threshold.

```bash
npu-smi clear -t tls-cert-period -i <id> -c <chip_id>
```

---

## AVI Commands

### info -t vnpu-mode

Query AVI mode.

```bash
npu-smi info -t vnpu-mode
```

---

### info -t template-info

Query AVI template information.

```bash
npu-smi info -t template-info [-i <id>]
```

---

### info -t info-vnpu

Query vNPU information.

```bash
npu-smi info -t info-vnpu -i <id> -c <chip_id>
```

---

### info -t vnpu-cfg-recover

Query vNPU config recovery status.

```bash
npu-smi info -t vnpu-cfg-recover
```

---

### set -t vnpu-mode

Set AVI mode.

```bash
npu-smi set -t vnpu-mode -d <mode>
```

**Parameters:**
- `mode`: 0=container, 1=VM

---

### set -t create-vnpu

Create vNPU.

```bash
npu-smi set -t create-vnpu -i <id> -c <chip_id> -f <template> [-v <vnpu_id>] [-g <group_id>]
```

**Parameters:**
- `template`: AVI template name
- `vnpu_id`: Optional vNPU ID
- `group_id`: Optional group ID [0-3]

---

### set -t destroy-vnpu

Destroy vNPU.

```bash
npu-smi set -t destroy-vnpu -i <id> -c <chip_id> -v <vnpu_id>
```

---

### set -t vnpu-cfg-recover

Set vNPU config recovery.

```bash
npu-smi set -t vnpu-cfg-recover -d <mode>
```

**Parameters:**
- `mode`: 0=disable, 1=enable

---

## Certificate Commands

### info -t tls-csr-get

Get CSR for certificate signing.

```bash
npu-smi info -t tls-csr-get -i <id> -c <chip_id>
```

---

### set -t tls-cert

Import/update TLS certificate.

```bash
npu-smi set -t tls-cert -i <id> -c <chip_id> -f "<tls> <ca> <subca>"
```

---

### info -t tls-cert

View certificate information.

```bash
npu-smi info -t tls-cert -i <id> -c <chip_id>
```

---

### set -t tls-cert-period

Set certificate expiration threshold.

```bash
npu-smi set -t tls-cert-period -i <id> -c <chip_id> -s <period>
```

**Parameters:**
- `period`: Days [7-180], default 90

---

### info -t tls-cert-period

Read certificate expiration threshold.

```bash
npu-smi info -t tls-cert-period -i <id> -c <chip_id>
```

---

### info -t rootkey

Query rootkey status.

```bash
npu-smi info -t rootkey -i <id> -c <chip_id>
```
