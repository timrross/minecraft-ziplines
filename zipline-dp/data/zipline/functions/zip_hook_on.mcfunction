#built using mc-build (https://github.com/mc-build/mc-build)

tag @s add used_hook
execute positioned ^ ^ ^.25 run execute as @e[type=marker,tag=front_zipline,distance=..0.3] at @s run function zipline:__generated__/block/22
tag @s remove used_hook
execute as @s[distance=..6] positioned ^ ^ ^0.25 if block ~ ~ ~ #zipline:zip_through_blocks unless entity @e[type=marker,tag=end_zipline,distance=...25] run function zipline:zip_hook_on