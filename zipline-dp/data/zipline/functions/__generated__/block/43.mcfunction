#built using mc-build (https://github.com/mc-build/mc-build)

execute facing entity @e[type=marker,tag=end_zipline,scores={zip.count=20..20}] eyes run tp @p ~ ~-2 ~ ~ ~
scoreboard players set @p[tag=used_hook,distance=..7] zip.move 20